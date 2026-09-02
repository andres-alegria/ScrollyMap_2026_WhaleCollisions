import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './map-intro.css';

gsap.registerPlugin(ScrollTrigger);

// Tuning handle, alongside window.__MAP__ and window.__MAPINTRO__. Useful in
// the console, and the only way to step this piece frame by frame in a browser
// whose rAF is throttled: ScrollTrigger.update() runs synchronously.
if (typeof window !== 'undefined') window.__ST__ = ScrollTrigger;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
// Decelerating: the descent should arrive rather than stop dead, and the last
// stretch of a zoom is where a linear rate reads fastest.
const easeOut = (t) => 1 - (1 - t) * (1 - t);

/**
 * The locating section: a full-screen map that starts on the world and closes
 * on the Mediterranean. Once the camera has arrived, a short full-width band
 * appears on the top edge and the copy rises up into it from below.
 *
 * The descent begins the moment the section appears at the bottom of the
 * viewport, not when it reaches the top, so the map is already moving as the
 * section arrives rather than waiting a whole screen-height to start.
 *
 * Deliberately the only full-screen map in the piece. Everything after this
 * happens inside the panel's frame, so this section is what establishes where
 * the story is before the frame takes over.
 *
 * The camera is interpolated against scroll rather than flown, for the same
 * reason as the panel: a flyTo would run on its own clock and fight the
 * scrub. Zoom is eased so the descent decelerates into place.
 */
const MapIntro = ({
  accessToken,
  mapStyle,
  from = { center: [15, 30], zoom: 1.5 },
  to = { center: [15.25, 38], zoom: 3.5 },
  eyebrow,
  label,
  text,
  // How much of the descent happens while the section is still travelling up
  // the screen, before it pins. The rest finishes just after it lands.
  enterShare = 0.6,    // adjust: share of the zoom spent on the way in
  arriveBy = 0.30,     // adjust: pinned progress at which the camera has landed
  cardFrom = 0.34,     // adjust: pinned progress at which the type starts rising
  cardBy = 0.58,       // adjust: pinned progress at which it has arrived
  dwell = 1.8,         // adjust: screen-heights the section holds
}) => {
  const sectionRef = useRef(null);
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const cardRef = useRef(null);
  const innerRef = useRef(null);
  // Two triggers drive one camera, so each keeps its own share of the
  // progress here and the camera is recomputed whenever either moves.
  const phaseRef = useRef({ enter: 0, pinned: 0 });

  useEffect(() => {
    if (!mapNodeRef.current || !accessToken || !mapStyle) return undefined;
    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
      container: mapNodeRef.current,
      style: mapStyle,
      center: from.center,
      zoom: from.zoom,
      interactive: false,
      attributionControl: true,
    });
    mapRef.current = map;
    // Exposed for tuning from the console, as the panel's map is via
    // window.__MAP__:  __MAPINTRO__.getZoom()
    if (typeof window !== 'undefined') window.__MAPINTRO__ = map;
    const onLoad = () => { map.resize(); ScrollTrigger.refresh(); };
    map.on('load', onLoad);
    return () => { map.off('load', onLoad); map.remove(); mapRef.current = null; };
  }, [accessToken, mapStyle, from.center, from.zoom]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    section.style.marginBottom = `${dwell * 100}vh`;

    let promoted = false;

    // One camera, two phases. Waiting for the pin to begin the descent means
    // the map sits still for the whole screen-height it takes the section to
    // arrive, which reads as nothing happening; this starts it the moment the
    // section appears at the bottom of the viewport.
    const applyCamera = () => {
      const { enter, pinned } = phaseRef.current;
      const k = easeOut(clamp01(
        enter * enterShare
        + clamp01(pinned / arriveBy) * (1 - enterShare)
      ));
      const map = mapRef.current;
      if (!map) return;
      map.jumpTo({
        center: [lerp(from.center[0], to.center[0], k),
                 lerp(from.center[1], to.center[1], k)],
        zoom: lerp(from.zoom, to.zoom, k),
      });
    };

    // Phase one: the section travelling from the bottom of the viewport to
    // the top. No pin here, it only reads scroll.
    const enterST = ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'top top',
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => { phaseRef.current.enter = self.progress; applyCamera(); },
    });

    // Phase two: pinned. Finishes the descent, then brings the card down.
    const pinST = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${window.innerHeight * (dwell + 1)}`,
      pin: true,
      pinSpacing: false,
      anticipatePin: 1,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        phaseRef.current.pinned = self.progress;
        applyCamera();
        // The card holds its place on the top edge; the TEXT rises into it
        // from below, clipped by the card, so the motion is upward rather
        // than the whole band dropping in.
        const c = clamp01((self.progress - cardFrom) / (cardBy - cardFrom));
        if (cardRef.current) {
          // the ground arrives ahead of the type, so the text rises into
          // something rather than floating over the map
          cardRef.current.style.opacity = String(clamp01(c * 2.5));
        }
        if (innerRef.current) {
          innerRef.current.style.transform = `translateY(${(1 - c) * 100}%)`;
        }
        const wantsLayer = c > 0 && c < 1;
        if (wantsLayer !== promoted) {
          promoted = wantsLayer;
          if (cardRef.current) cardRef.current.style.willChange = wantsLayer ? 'opacity' : '';
          if (innerRef.current) innerRef.current.style.willChange = wantsLayer ? 'transform' : '';
        }
      },
    });

    return () => { enterST.kill(); pinST.kill(); };
  }, [from, to, enterShare, arriveBy, cardFrom, cardBy, dwell]);

  return (
    <section className="map-intro" ref={sectionRef}>
      <div className="map-intro__map" ref={mapNodeRef} />
      <div className="map-intro__card" ref={cardRef} style={{ opacity: 0 }}>
        <div
          className="map-intro__inner"
          ref={innerRef}
          style={{ transform: 'translateY(100%)' }}
        >
          {eyebrow && <p className="map-intro__eyebrow">{eyebrow}</p>}
          {label && <h3 className="map-intro__label font-lora">{label}</h3>}
          {text && (
            <p className="map-intro__text" dangerouslySetInnerHTML={{ __html: text }} />
          )}
        </div>
      </div>
    </section>
  );
};

export default MapIntro;
