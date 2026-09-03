import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { addTrafficLayers, setTraffic } from './traffic-layers';
import { addLabelLayers } from './label-layers';
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

// The basin's bounding box: Gibraltar to the Levant, the African coast to the
// head of the Adriatic. The arrival is framed from this rather than from a
// centre written by hand, so it lands on the Mediterranean whatever shape the
// screen is. Padded so the sea does not sit hard against the edges.
// ---- adjust the basin's framing ----
const BASIN = { west: -6, south: 30, east: 36.5, north: 46 };
const BASIN_PAD = 0.08;

// The traffic tileset has a cliff here. At zoom 3 and above Mapbox serves all
// 24,932 cells; below it the tiles are decimated to 370, clustered in the
// western basin. The card claims 24,254 patches of water carried traffic, and
// the cells beneath it are the evidence, so the camera must not arrive under
// this line. It only constrains the arrival: nothing is drawn during the
// descent, so the opening zoom is free to be as wide as it likes.
// ---- do not lower without checking the tileset's minzoom ----
const TILESET_FLOOR = 3;

// Web Mercator's vertical coordinate. Latitude is not linear on the screen, so
// the middle of a latitude range is not the middle of the frame.
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mercLat = (y) => ((2 * (Math.atan(Math.exp(y)) - Math.PI / 4)) * 180) / Math.PI;

/**
 * The camera that shows the basin in a frame of this size.
 *
 * A fixed arrival only works at one screen shape: 3.5 centred on 15.25E frames
 * the Mediterranean on a desktop, and on a phone the same numbers put a third
 * of the Atlantic on screen. Mercator's world is 512 CSS px at zoom 0, so both
 * the zoom that fits a span and the centre of a box fall straight out of that.
 *
 * Bounded at both ends. Capped at the target zoom, so a wide screen keeps the
 * framing the piece was designed for rather than pushing in closer; floored at
 * the tileset's, so a narrow one crops the ends off the sea rather than
 * arriving somewhere the traffic cannot be drawn.
 */
const frameBasin = (widthPx, heightPx, maxZoom) => {
  const centre = [
    (BASIN.west + BASIN.east) / 2,
    mercLat((mercY(BASIN.north) + mercY(BASIN.south)) / 2),
  ];
  if (!widthPx || !heightPx) return { center: centre, zoom: maxZoom };
  const lon = (BASIN.east - BASIN.west) * (1 + BASIN_PAD);
  const zLon = Math.log2((360 * widthPx) / (512 * lon));
  const dy = (Math.abs(mercY(BASIN.north) - mercY(BASIN.south)) / (2 * Math.PI))
    * (1 + BASIN_PAD);
  const zLat = dy > 0 ? Math.log2(heightPx / (512 * dy)) : maxZoom;
  return {
    center: centre,
    zoom: Math.max(TILESET_FLOOR, Math.min(maxZoom, zLon, zLat)),
  };
};

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
  // The pinned phase has a long tail after the card has arrived and before the
  // panel reaches the top of the screen. The map is taken down to black across
  // it, so the story arrives over solid ground rather than over the basin: the
  // panel travels up for a whole screen-height before it pins, and until it
  // does, everything above its top edge is still this map. Land in this style
  // is nearly the panel's own ground colour, so it reads as the map ghosting
  // through a translucent background rather than as the section it still is.
  leaveFrom = 0.62,    // adjust: when the locating map starts going to black
  leaveBy = 0.86,      // adjust: when it has got there
  // How far down the frame the map sits, in pixels. The card lands on the top
  // edge, and without this the north coast of the basin runs right under it.
  // Roughly two lines of body copy.
  // ---- adjust how far the map drops clear of the card ----
  dropBy = 52,
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
      // Attribution. The compact control puts an (i) button in the corner that
      // has to be opened to read anything; switched off here and replaced with
      // the plain text, which is quieter on the page and legible without a
      // click. What it says is not ours to change: the basemap is OpenStreetMap
      // under ODbL, which requires crediting OSM contributors wherever the map
      // appears, and Mapbox's terms require their wordmark on the map itself.
      // Removing either needs an agreement with Mapbox, not a code change.
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: false }), 'bottom-right');
    mapRef.current = map;
    // Exposed for tuning from the console, as the panel's map is via
    // window.__MAP__:  __MAPINTRO__.getZoom()
    if (typeof window !== 'undefined') window.__MAPINTRO__ = map;
    const onLoad = () => {
      map.resize();
      addTrafficLayers(map);
      // The locating section names the sea in its own card; the basemap's
      // place labels would only compete with it, and this far out they are a
      // scatter of city names over the subject.
      addLabelLayers(map);
      ScrollTrigger.refresh();
    };
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
      const node = map.getContainer();
      const arrive = frameBasin(node.clientWidth, node.clientHeight, to.zoom);
      map.jumpTo({
        center: [lerp(from.center[0], arrive.center[0], k),
                 lerp(from.center[1], arrive.center[1], k)],
        zoom: lerp(from.zoom, arrive.zoom, k),
        // Padding at the top moves the center point down by half of it, so the
        // basin clears the card. Doing it here rather than by shifting the
        // target latitude keeps the drop the same distance on screen at every
        // zoom, and keeps `to.center` meaning the place it names.
        padding: { top: dropBy * 2, bottom: 0, left: 0, right: 0 },
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

        // The slow band comes up slightly ahead of the type: it is the
        // evidence for the claim the card makes, so it is already there when
        // the sentence arrives.
        if (mapRef.current) {
          setTraffic(mapRef.current, { slow: clamp01(c * 1.6) * 0.85 });
        }
        if (cardRef.current) {
          // the ground arrives ahead of the type, so the text rises into
          // something rather than floating over the map
          cardRef.current.style.opacity = String(clamp01(c * 2.5));
        }
        if (innerRef.current) {
          innerRef.current.style.transform = `translateY(${(1 - c) * 100}%)`;
        }
        // Down to black for the handoff. The section keeps its own dark
        // ground, so this fades the map alone and lands on the same colour the
        // panel arrives with.
        // Finished well before the pin releases, not at the end of it: the
        // panel is already climbing the screen by then, and the point is that
        // it climbs over black rather than over the basin.
        const leave = clamp01((self.progress - leaveFrom) / (leaveBy - leaveFrom));
        if (mapNodeRef.current) {
          mapNodeRef.current.style.opacity = String(1 - leave);
        }

        const wantsLayer = c > 0 && c < 1;
        if (wantsLayer !== promoted) {
          promoted = wantsLayer;
          if (cardRef.current) cardRef.current.style.willChange = wantsLayer ? 'opacity' : '';
          if (innerRef.current) innerRef.current.style.willChange = wantsLayer ? 'transform' : '';
        }
      },
    });

    // The map was told its size once, at load. Nothing told it again: this
    // handler only re-ran the camera. On a phone, where the address bar
    // collapsing changes the viewport, that leaves Mapbox projecting against a
    // stale size, so the camera lands somewhere other than where it was aimed.
    // Both are needed - resize() for the projection, applyCamera() because the
    // framing is computed from the frame's own pixels.
    const remeasure = () => {
      const map = mapRef.current;
      if (!map) return;
      map.resize();
      applyCamera();
    };
    window.addEventListener('resize', remeasure);
    window.addEventListener('orientationchange', remeasure);
    // A window resize is not the only way this box changes size.
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(remeasure) : null;
    if (ro && mapNodeRef.current) ro.observe(mapNodeRef.current);

    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('orientationchange', remeasure);
      if (ro) ro.disconnect();
      enterST.kill();
      pinST.kill();
    };
  }, [from, to, enterShare, arriveBy, cardFrom, cardBy, dwell, dropBy, leaveFrom, leaveBy]);

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
