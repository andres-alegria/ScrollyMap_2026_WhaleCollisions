import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { addTrafficLayers, setTraffic } from './traffic-layers';
import ScaleBar from './scale-bar';
import LocatorGlobe from './locator-globe';
import './map-panel.css';

gsap.registerPlugin(ScrollTrigger);

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
// never spin the long way round
const lerpLon = (a, b, t) => {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
};

// ScrollTrigger measures the section once at mount; web fonts arriving later
// reflow it and leave that measurement stale.
let refreshQueued = false;
const refreshWhenSettled = () => {
  if (refreshQueued) return;
  refreshQueued = true;
  const go = () => ScrollTrigger.refresh();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(go));
  } else {
    window.addEventListener('load', go, { once: true });
  }
};

/**
 * Pick a round distance for the scale bar that lands near a target share of
 * the frame, so the bar keeps a sensible length as the camera zooms.
 */
const NICE = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
const scaleFor = (map, widthPx, target = 0.22) => {
  if (!map || !widthPx) return null;
  const lat = map.getCenter().lat;
  const mpp = 156543.03392 * Math.cos((lat * Math.PI) / 180) / (2 ** map.getZoom());
  const wantKm = (widthPx * target * mpp) / 1000;
  let n = NICE[0];
  for (const c of NICE) if (Math.abs(c - wantKm) < Math.abs(n - wantKm)) n = c;
  return {
    n,
    kmFrac: (n * 1000) / mpp / widthPx,
    miFrac: (n * 1609.344) / mpp / widthPx,
  };
};

/**
 * One box, held still, with a live map inside it.
 *
 * The story does not hand off between separate panels: this section pins once
 * and stays, and scrolling moves the CAMERA inside the frame while the
 * paragraph beside it changes to match. Each step carries both a camera and
 * its text, so the two can never drift apart.
 *
 * The camera is interpolated, not flown. flyTo runs on its own clock and would
 * fight a scrubbed scroll, arriving late and overshooting when the reader
 * changes direction; jumpTo on an interpolated position tracks the scroll
 * exactly, which is how the rest of this piece behaves.
 */
const MapPanel = ({
  steps = [],
  accessToken,
  mapStyle,
  aspect = '4 / 3',
  dwell = 1.6,          // adjust: screen-heights of scroll per step
  recedeFrom = 0.9,     // adjust: when the section starts giving way
}) => {
  const sectionRef = useRef(null);
  const frameRef = useRef(null);
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const textRefs = useRef([]);
  const [scale, setScale] = useState(null);
  const [locator, setLocator] = useState(steps[0] ? steps[0].center : null);
  const [place, setPlace] = useState(steps[0] ? steps[0].place : '');

  // --- the map itself, created once ---------------------------------
  useEffect(() => {
    if (!mapNodeRef.current || !accessToken || !mapStyle || !steps.length) return undefined;
    mapboxgl.accessToken = accessToken;
    const first = steps[0];
    const map = new mapboxgl.Map({
      container: mapNodeRef.current,
      style: mapStyle,
      center: first.center,
      zoom: first.zoom,
      pitch: first.pitch || 0,
      bearing: first.bearing || 0,
      interactive: false,        // the scroll drives it; a stray drag would fight
      attributionControl: true,
    });
    mapRef.current = map;
    if (typeof window !== 'undefined') window.__MAP__ = map;

    const onLoad = () => {
      map.resize();
      addTrafficLayers(map);
      // the layers start invisible, so paint the first step's state at once
      // rather than waiting for the first scroll
      if (steps[0] && steps[0].traffic) setTraffic(map, steps[0].traffic);
      setScale(scaleFor(map, frameRef.current ? frameRef.current.clientWidth : 0));
      // the section's height depends on nothing the map does, but its
      // measurements were taken before the frame had content
      ScrollTrigger.refresh();
    };
    map.on('load', onLoad);

    const ro = new ResizeObserver(() => {
      map.resize();
      setScale(scaleFor(map, frameRef.current ? frameRef.current.clientWidth : 0));
    });
    if (frameRef.current) ro.observe(frameRef.current);

    return () => {
      ro.disconnect();
      map.off('load', onLoad);
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, mapStyle, steps]);

  // --- scroll drives the camera and the text ------------------------
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !steps.length) return undefined;

    const hold = Math.max(1, steps.length - 1) * dwell;
    section.style.marginBottom = `${hold * 100}vh`;

    let promoted = false;
    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${window.innerHeight * (hold + 1)}`,
      pin: true,
      pinSpacing: false,
      anticipatePin: 1,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const n = steps.length;
        // progress across the steps, before the section starts receding
        const p = clamp01(self.progress / recedeFrom) * (n - 1);
        const i = Math.min(n - 2, Math.floor(p));
        const f = n > 1 ? clamp01(p - i) : 0;
        const a = steps[i] || steps[0];
        const b = steps[i + 1] || a;

        const map = mapRef.current;
        if (map) {
          map.jumpTo({
            center: [lerpLon(a.center[0], b.center[0], f), lerp(a.center[1], b.center[1], f)],
            zoom: lerp(a.zoom, b.zoom, f),
            pitch: lerp(a.pitch || 0, b.pitch || 0, f),
            bearing: lerp(a.bearing || 0, b.bearing || 0, f),
          });
          // the data layers travel with the camera, interpolated the same way,
          // so a band fades in over the same stretch the camera moves
          const ta = a.traffic || {};
          const tb = b.traffic || {};
          const at = (k) => lerp(ta[k] || 0, tb[k] || 0, f);
          setTraffic(map, { slow: at('slow'), mid: at('mid'), fast: at('fast'), hot: at('hot') });
        }

        // Text: each step fades in AND out again. Fading in only would leave
        // every earlier paragraph sitting behind the current one - they are
        // transparent, so they stack rather than cover.
        for (let k = 0; k < n; k++) {
          const d = Math.abs(p - k);
          const o = clamp01(1 - d / 0.55);
          const el = textRefs.current[k];
          if (el) {
            el.style.opacity = String(o);
            el.style.transform = `translateY(${(1 - o) * 10}px)`;
            // an invisible paragraph must not swallow selection or clicks
            el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
          }
        }

        const nearest = Math.round(p);
        const s = steps[nearest];
        if (s) {
          if (s.center) setLocator(s.center);
          setPlace(s.place || '');
        }
        if (map) setScale(scaleFor(map, frameRef.current ? frameRef.current.clientWidth : 0));

        const r = clamp01((self.progress - recedeFrom) / (1 - recedeFrom));
        const wantsLayer = r > 0;
        if (wantsLayer !== promoted) {
          promoted = wantsLayer;
          section.style.willChange = wantsLayer ? 'transform, opacity' : '';
        }
        section.style.transform = `scale(${1 - 0.06 * r})`;
        section.style.opacity = String(1 - 0.4 * r);
      },
    });

    refreshWhenSettled();
    return () => { st.kill(); };
  }, [steps, dwell, recedeFrom]);

  if (!steps.length) return null;

  return (
    <section className="map-panel" ref={sectionRef}>
      <div className="map-panel__body">
        <div className="map-panel__col">
          <div className="map-panel__frame" ref={frameRef} style={{ aspectRatio: aspect }}>
            <div className="map-panel__map" ref={mapNodeRef} />
            {scale && <ScaleBar {...scale} />}
            <LocatorGlobe center={locator} place={place} />
          </div>
        </div>

        {/* Steps are stacked in one grid cell so the column keeps a single
            height; only the current one is opaque. */}
        <div className="map-panel__card">
          <div className="map-panel__steps">
            {steps.map((s, i) => (
              <div
                key={s.label || i}
                className="map-panel__step"
                ref={(el) => { textRefs.current[i] = el; }}
                style={{ opacity: i === 0 ? 1 : 0 }}
              >
                {s.eyebrow && <p className="map-panel__eyebrow">{s.eyebrow}</p>}
                {s.label && <h3 className="map-panel__label font-lora">{s.label}</h3>}
                {s.text && (
                  <p className="map-panel__text"
                     dangerouslySetInnerHTML={{ __html: s.text }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MapPanel;
