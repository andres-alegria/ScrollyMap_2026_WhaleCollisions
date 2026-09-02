import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './map-intro.css';

gsap.registerPlugin(ScrollTrigger);

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
// Decelerating: the descent should arrive rather than stop dead, and the last
// stretch of a zoom is where a linear rate reads fastest.
const easeOut = (t) => 1 - (1 - t) * (1 - t);

/**
 * The locating section: a full-screen map that starts on the world and closes
 * on the Mediterranean as the section is entered, then hands a short
 * full-width card up from the bottom once it has arrived.
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
  arriveBy = 0.62,     // adjust: progress at which the camera has landed
  cardFrom = 0.52,     // adjust: progress at which the card starts rising
  cardBy = 0.78,       // adjust: progress at which the card is fully up
  dwell = 1.8,         // adjust: screen-heights the section holds
}) => {
  const sectionRef = useRef(null);
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const cardRef = useRef(null);

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
    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${window.innerHeight * (dwell + 1)}`,
      pin: true,
      pinSpacing: false,
      anticipatePin: 1,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        const k = easeOut(clamp01(p / arriveBy));
        const map = mapRef.current;
        if (map) {
          map.jumpTo({
            center: [lerp(from.center[0], to.center[0], k),
                     lerp(from.center[1], to.center[1], k)],
            zoom: lerp(from.zoom, to.zoom, k),
          });
        }
        // the card rises from the bottom edge once the camera is nearly there
        const c = clamp01((p - cardFrom) / (cardBy - cardFrom));
        if (cardRef.current) {
          cardRef.current.style.transform = `translateY(${(1 - c) * 100}%)`;
          cardRef.current.style.opacity = String(c);
        }
        const wantsLayer = c > 0 && c < 1;
        if (wantsLayer !== promoted) {
          promoted = wantsLayer;
          if (cardRef.current) {
            cardRef.current.style.willChange = wantsLayer ? 'transform, opacity' : '';
          }
        }
      },
    });
    return () => { st.kill(); };
  }, [from, to, arriveBy, cardFrom, cardBy, dwell]);

  return (
    <section className="map-intro" ref={sectionRef}>
      <div className="map-intro__map" ref={mapNodeRef} />
      <div
        className="map-intro__card"
        ref={cardRef}
        style={{ opacity: 0, transform: 'translateY(100%)' }}
      >
        <div className="map-intro__inner">
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
