import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  loadWorld, loadStoryData, bucketTraffic, makeProjection, rotationFor,
  shortestDelta, isVisible, arcFeature, partialLineByTime, trackSpan,
  geoPath, geoGraticule10, hexToRgb, mixRgb, rgbCss
} from './globe-utils';
import './globe.scss';

/* ------------------------------------------------------------------
   D3 orthographic globe carrying the whole story.

   Motion is SCROLL-SCRUBBED, not tweened. Each chapter's `globe` block is
   a keyframe anchored to that chapter's position in the document; every
   frame the globe reads the scroll offset, finds which pair of keyframes
   it sits between, and interpolates. The camera therefore tracks the
   reader's scroll exactly rather than easing to a target after arrival.

   Per chapter, config.js sets:

     globe: {
       center: [lon, lat],   // spins so this faces the viewer
       scale: 1,             // 1 = whole sphere; raise to zoom in
       opacity: 1,
       data: { mediterranean: 1, medOutline: 1, habitats: 1, ... },
                              // mediterranean = filled basin
                              // medOutline    = its coastline, stroked
                              // every data layer is clipped to the basin
       graticule: 0,          // 1 by default; 0 hides the lat/lon lines
       trackProgress: 1,     // 12 whale tracks draw on
       highlight: [380, 300],
       markers: [{ coords, label, labelOffset, color }],
       arcs: [{ from, to, color }]
     }

   Because motion is tied to scroll distance, chapter block heights are
   part of the choreography - a taller chapter means a slower move.
   ------------------------------------------------------------------ */

// adjust globe colors here
/* ------------------------------------------------------------------
   Palette, following the printed map for this story.

   The land/sea relationship is inverted from a normal basemap: the SEA
   carries the color and the land recedes to charcoal, because the sea is
   the subject. Everything else is Mongabay's secondary palette, one family
   per role, which is what keeps four overlapping datasets separable:

     Blue family   the sea itself, and the slow traffic that covers it
     Orange family the whale habitats
     Red family    vessels above 15 knots, the threat
     Mint          the whales

   The brand asks for a single hue family per graphic, but makes an explicit
   exception for cartography carrying many categories, where contrast wins.
   ------------------------------------------------------------------ */
const COLORS = {
  space: '#181818',           // Charcoal, brand
  // Blue family, a step above the #123940 dark so the sea reads as the
  // brightest large area on the globe rather than as a void
  ocean: '#17505A',
  oceanEdge: '#2B5F5A',       // Teal Dark, brand: defines the limb
  land: '#30363A',            // tonal lift off Charcoal, as on the printed map
  landHighlight: '#006A54',   // Emerald Green, brand
  graticule: 'rgba(255,255,255,0.10)',
  mediterranean: '#BDEAAF',   // adjust the highlighted-sea color here
  // The basin edge sits in the sea's own family so that mint reads only as
  // whale movement. adjust the basin coastline color here
  medOutline: '#74ADB3',
  habitatFill: 'rgba(232,166,67,0.12)',
  habitatLine: '#E8A643',     // Orange mid, brand: the habitat color
  habitatLabel: '#E8A643',
  track: 'rgba(191,236,177,0.75)',   // Mint Green, brand
  arc: 'rgba(252,252,252,0.85)',
  timeline: '#BFECB1',        // adjust the track-timeline color here
  timelineRule: 'rgba(252,252,252,0.28)',
  marker: '#E86D6D',          // Red mid, brand
  markerRing: '#FCFCFC'
};

// Traffic ramps. Every class has TWO of them and a chapter chooses how far to
// blend between them, via its `hot*` value (0 = cool, 1 = hot):
//
//   cool  - three tints of the ocean color #123940, one band per class. The
//           opening traffic chapter uses these so the whole basin can be shown
//           at full extent without shouting.
//   hot   - the Mongabay red family. Chapters about speed bring the 15-25 and
//           >25 bands up into these while the slow band stays cool.
//
// `max` is the vessel-hours value that saturates a ramp. Set it from cells
// INSIDE the basin only: the fast ramp used to sit at 1200, a figure driven by
// Black Sea cells near Kerch that the story clips away and never draws, which
// left the visible fast traffic stuck in the pale half of its ramp.
//
// adjust traffic ramps here
const TRAFFIC_CLASSES = [
  { key: 's', layer: 'trafficSlow', hot: 'hotSlow', max: 6000,
    coolFrom: '#1E606C', coolTo: '#2C7583',
    from: '#F8DDD8', to: '#E8938A' },
  // The two fast bands are FLAT: from and to are the same color, so a cell
  // says which speed class it belongs to and nothing else. Their `max` no
  // longer affects what is drawn, only which bucket a cell lands in.
  { key: 'm', layer: 'trafficMid',  hot: 'hotMid',  max: 2500,
    coolFrom: '#25707E', coolTo: '#3C919F',
    from: '#F6BCB3', to: '#F6BCB3' },
  { key: 'f', layer: 'trafficFast', hot: 'hotFast', max: 600,
    coolFrom: '#2F8697', coolTo: '#59AFBF',
    from: '#530E0D', to: '#530E0D' }
];

// hex parsed once at module load, not per frame
TRAFFIC_CLASSES.forEach((c) => {
  c.rgb = {
    coolFrom: hexToRgb(c.coolFrom), coolTo: hexToRgb(c.coolTo),
    from: hexToRgb(c.from), to: hexToRgb(c.to)
  };
});


// Viewport size taken from the canvas's own box rather than from
// window.innerWidth/innerHeight. The canvas is 100vw x 100lvh in CSS, and lvh
// ignores a mobile browser's toolbar sliding in and out - innerHeight does
// not, and following it made the whole globe shift on every scroll-up.
const viewportOf = (canvas) => [
  (canvas && canvas.clientWidth) || window.innerWidth,
  (canvas && canvas.clientHeight) || window.innerHeight
];

const lerp = (a, b, t) => a + (b - a) * t;
// Linear: the camera tracks scroll 1:1, so the globe moves exactly as far as
// the reader scrolls and stops the instant they do. Velocity changes at each
// chapter anchor, which is the cost of that directness.
// For motion that settles into each chapter instead, swap in a smoothstep:
//   const ease = (t) => t * t * (3 - 2 * t);
const ease = (t) => t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const DATA_LAYERS = [
  'mediterranean', 'medOutline', 'habitats',
  'trafficSlow', 'trafficMid', 'trafficFast',
  // how far each traffic band is pushed from the cool basin palette toward
  // the red speed palette: 0 = muted, 1 = full color
  'hotSlow', 'hotMid', 'hotFast',
  'whaleTracks',
  // the month/year readout that runs with the tracks
  'timeline'
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// UTC deliberately: the reader's timezone must not shift which month is shown
const monthYear = (ms) => {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// Motion comes from scroll position, not from the active chapter, so this
// component no longer needs currentChapterId.
const Globe = ({ chapters }) => {
  const canvasRef = useRef(null);
  const dataRef = useRef(null);
  const keyframesRef = useRef([]);
  const stateRef = useRef({
    lambda: 0, phi: 0, scale: 1, opacity: 0, trackProgress: 0, graticule: 1,
    backdrop: COLORS.space, markerSets: [], arcSets: [], highlightSets: [],
    layer: DATA_LAYERS.reduce((o, k) => ({ ...o, [k]: 0 }), {})
  });
  const [ready, setReady] = useState(false);

  // --- load geometry once -------------------------------------------
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadWorld(), loadStoryData()])
      .then(([world, story]) => {
        if (cancelled) return;
        dataRef.current = {
          ...world,
          habitats: story.habitats,
          tracks: story.tracks,
          mediterranean: story.mediterranean,
          // Ring 0 alone. The other 37 rings are island holes - Sicily,
          // Sardinia, Corsica, Crete, Cyprus, the Aegean group - and stroking
          // them would ring every island in green, so the outline layer uses
          // only the coastline that wraps the basin as a whole.
          medOutline: {
            type: 'Polygon',
            coordinates: [
              story.mediterranean.features[0].geometry.coordinates[0]
            ]
          },
          // bucketing happens once; the render loop only fills paths
          traffic: bucketTraffic(story.traffic, TRAFFIC_CLASSES),
          span: trackSpan(story.tracks)
        };
        setReady(true);
      })
      .catch((err) => console.error('[globe] data load failed', err));
    return () => { cancelled = true; };
  }, []);

  // --- draw ----------------------------------------------------------
  useEffect(() => {
    if (!ready) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Interpolate the globe's state from the current scroll offset. This is
    // what makes the motion scrubbed: no tweens are running, the camera is a
    // pure function of where the reader is on the page.
    const resolveState = () => {
      const kf = keyframesRef.current;
      const s = stateRef.current;
      if (!kf.length) { s.opacity = 0; return s; }

      const y = window.scrollY;
      let i = 0;
      while (i < kf.length - 1 && y >= kf[i + 1].anchor) i++;
      const a = kf[i];
      const b = kf[Math.min(i + 1, kf.length - 1)];
      const solo = a === b;

      const span = solo ? 0 : b.anchor - a.anchor;
      const t = span > 0 ? clamp01((y - a.anchor) / span) : 0;
      const e = ease(t);
      const ga = a.g, gb = b.g;

      const [la, pa] = rotationFor(ga.center || [0, 0]);
      const [lbRaw, pb] = rotationFor(gb.center || [0, 0]);
      const lb = la + shortestDelta(la, lbRaw);   // never spin the long way

      s.lambda = lerp(la, lb, e);
      s.phi = lerp(pa, pb, e);
      s.scale = lerp(ga.scale ?? 1, gb.scale ?? 1, e);
      s.opacity = lerp(ga.opacity ?? 1, gb.opacity ?? 1, e);
      s.backdrop = gb.backdrop ?? ga.backdrop ?? COLORS.space;
      s.graticule = lerp(ga.graticule ?? 1, gb.graticule ?? 1, e);
      s.trackProgress = lerp(ga.trackProgress ?? 0, gb.trackProgress ?? 0, e);

      DATA_LAYERS.forEach((k) => {
        s.layer[k] = lerp((ga.data || {})[k] ?? 0, (gb.data || {})[k] ?? 0, e);
      });

      // Discrete content cross-fades, except where neighbors declare the
      // same set - then it is drawn once, so it does not dip mid-segment.
      const pair = (key, sameFlag, build) => {
        const A = ga[key], B = gb[key];
        if (solo || sameFlag) return A && A.length ? [build(A, 1, 1)] : [];
        const out = [];
        if (A && A.length) out.push(build(A, 1 - e, 1));
        if (B && B.length) out.push(build(B, e, e));
        return out;
      };

      s.markerSets = pair('markers', a.sameMarkers, (v, alpha) => ({ markers: v, alpha }));
      s.arcSets = pair('arcs', a.sameArcs, (v, alpha, progress) => ({ arcs: v, alpha, progress }));
      s.highlightSets = pair('highlight', a.sameHighlight, (v, alpha) => ({ ids: v, alpha }));

      return s;
    };

    const draw = () => {
      const s = resolveState();
      const d = dataRef.current;
      const dpr = window.devicePixelRatio || 1;
      const [w, h] = viewportOf(canvas);

      // Only the backing store is set here; the element's own size stays with
      // the stylesheet, so nothing here can fight the 100lvh rule.
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr; canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      if (s.opacity <= 0.001) { ctx.restore(); return; }
      ctx.globalAlpha = s.opacity;

      // Round joins for every stroke on the globe. Coastlines turn on
      // themselves at headlands and river mouths, and canvas's default miter
      // join extrudes those corners into spikes up to ten times the line
      // weight before it gives up and bevels them.
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      if (s.backdrop) { ctx.fillStyle = s.backdrop; ctx.fillRect(0, 0, w, h); }

      const projection = makeProjection(w, h, s.scale).rotate([s.lambda, s.phi, 0]);
      const path = geoPath(projection, ctx);

      // Where the story sits in the tagging record, from April 2021 to
      // August 2024. Scrubbed by scroll like everything else on the globe.
      const p = clamp01(s.trackProgress);
      // not a straight interpolation: the clock skips quickly through the
      // months when no whale was transmitting. See trackSpan in globe-utils.
      const clock = d.span ? d.span.at(p) : 0;

      // sphere
      ctx.beginPath(); path({ type: 'Sphere' });
      ctx.fillStyle = COLORS.ocean; ctx.fill();
      ctx.strokeStyle = COLORS.oceanEdge; ctx.lineWidth = 1; ctx.stroke();

      // graticule
      if (s.graticule > 0.001) {
        ctx.globalAlpha = s.opacity * s.graticule;
        ctx.beginPath(); path(geoGraticule10());
        ctx.strokeStyle = COLORS.graticule; ctx.lineWidth = 0.5; ctx.stroke();
        ctx.globalAlpha = s.opacity;
      }

      // land
      ctx.beginPath(); path(d.land);
      ctx.fillStyle = COLORS.land; ctx.fill();

      // --- Mediterranean ---------------------------------------------
      // Drawn after land: the polygon carries the big islands as holes, so
      // they keep the land color rather than being painted over.
      if (s.layer.mediterranean > 0.001) {
        ctx.globalAlpha = s.opacity * s.layer.mediterranean;
        ctx.beginPath(); path(d.mediterranean);
        ctx.fillStyle = COLORS.mediterranean; ctx.fill();
        ctx.globalAlpha = s.opacity;
      }

      s.highlightSets.forEach(({ ids, alpha }) => {
        const wanted = d.countries.features.filter(
          (f) => ids.includes(Number(f.id)) || ids.includes(f.properties?.name)
        );
        if (!wanted.length) return;
        ctx.globalAlpha = s.opacity * alpha;
        ctx.beginPath(); wanted.forEach((f) => path(f));
        ctx.fillStyle = COLORS.landHighlight; ctx.fill();
      });
      ctx.globalAlpha = s.opacity;

      // --- data layers, confined to the basin -------------------------
      // Everything the story adds to the globe is clipped to Mediterranean
      // water. The reader never sees traffic bleeding into the Atlantic past
      // Gibraltar or into the Black Sea, and because the polygon carries the
      // big islands as holes, cells sitting on Sicily or Sardinia are cut too.
      // Any layer added later inherits this simply by being drawn in here.
      ctx.save();
      ctx.beginPath(); path(d.mediterranean);
      ctx.clip();

      // --- traffic ---------------------------------------------------
      // Cells are 0.1 deg quads, a pixel or two on screen. Rather than feeding
      // ~14k of them through geoPath, each cell's unit vector is rotated inline
      // (pure arithmetic, no trig in the loop) and stamped with fillRect.
      const anyTraffic = TRAFFIC_CLASSES.some(({ layer }) => s.layer[layer] > 0.001);
      if (anyTraffic) {
        const RAD = Math.PI / 180;
        const rot = projection.rotate();
        const cl = Math.cos(rot[0] * RAD), sl = Math.sin(rot[0] * RAD);
        const cp = Math.cos(rot[1] * RAD), sp = Math.sin(rot[1] * RAD);
        const [tx, ty] = projection.translate();
        const k = projection.scale();

        // cell size in pixels, measured once per frame at the view center
        const c0 = projection([-rot[0], -rot[1]]);
        const cx = projection([-rot[0] + 0.1, -rot[1]]);
        const cy = projection([-rot[0], -rot[1] + 0.1]);
        const cw = Math.max(1, Math.abs(cx[0] - c0[0]));
        const ch = Math.max(1, Math.abs(cy[1] - c0[1]));
        const hw = cw / 2, hh = ch / 2;

        TRAFFIC_CLASSES.forEach(({ key, layer, hot, rgb }) => {
          const alpha = s.layer[layer];
          if (alpha <= 0.001) return;
          ctx.globalAlpha = s.opacity * alpha;
          const heat = clamp01(s.layer[hot] ?? 0);

          (d.traffic[key] || []).forEach((b) => {
            // the bucket stores its position in the ramp; the palette blend
            // happens here, so a chapter can sit part-way between the two
            const cool = mixRgb(rgb.coolFrom, rgb.coolTo, b.t);
            const warm = mixRgb(rgb.from, rgb.to, b.t);
            ctx.fillStyle = rgbCss(mixRgb(cool, warm, heat));
            const { n, ax, by, cz } = b;
            for (let i = 0; i < n; i++) {
              const a = ax[i], bb = by[i], c = cz[i];
              // rotate by lambda about the polar axis
              const x1 = a * cl - bb * sl;
              const y1 = bb * cl + a * sl;
              // then by phi, matching d3's rotation order
              const x2 = x1 * cp - c * sp;
              if (x2 <= 0) continue;               // far side of the sphere
              const z2 = c * cp + x1 * sp;
              ctx.fillRect(tx + k * y1 - hw, ty - k * z2 - hh, cw, ch);
            }
          });
        });
      }

      // --- habitats --------------------------------------------------
      if (s.layer.habitats > 0.001) {
        ctx.globalAlpha = s.opacity * s.layer.habitats;
        ctx.beginPath();
        d.habitats.features.forEach((f) => path(f));
        ctx.fillStyle = COLORS.habitatFill; ctx.fill();
        ctx.strokeStyle = COLORS.habitatLine; ctx.lineWidth = 1.2; ctx.stroke();
      }

      // --- whale tracks ---------------------------------------------
      // Drawn against a clock, not against each track's own length, so the
      // twelve appear in the order they were actually tagged.
      if (s.layer.whaleTracks > 0.001) {
        ctx.globalAlpha = s.opacity * s.layer.whaleTracks;
        ctx.strokeStyle = COLORS.track;
        ctx.lineWidth = 0.7;
        d.tracks.features.forEach((f) => {
          const times = f.properties && f.properties.coordinateProperties
            && f.properties.coordinateProperties.times;
          const g = partialLineByTime(f.geometry.coordinates, times, clock);
          if (!g) return;          // this whale has not been tagged yet
          ctx.beginPath();
          path(g);
          ctx.stroke();
        });
      }

      ctx.restore();          // end of the basin clip
      ctx.globalAlpha = s.opacity;

      // --- basin outline ---------------------------------------------
      // Drawn after the data so a dense band of traffic along a coast cannot
      // swallow the line that frames it.
      if (s.layer.medOutline > 0.001) {
        ctx.globalAlpha = s.opacity * s.layer.medOutline;
        ctx.beginPath(); path(d.medOutline);
        ctx.strokeStyle = COLORS.medOutline;
        ctx.lineWidth = 1;    // adjust the basin coastline weight here
        ctx.stroke();
        ctx.globalAlpha = s.opacity;
      }

      // --- arcs ------------------------------------------------------
      s.arcSets.forEach(({ arcs, alpha, progress }) => {
        ctx.globalAlpha = s.opacity * alpha;
        arcs.forEach((a) => {
          ctx.beginPath();
          path(arcFeature(a.from, a.to, Math.max(0.02, progress)));
          ctx.strokeStyle = a.color || COLORS.arc;
          ctx.lineWidth = a.width || 1.6;
          ctx.stroke();
        });
      });
      ctx.globalAlpha = s.opacity;

      // --- markers ---------------------------------------------------
      s.markerSets.forEach(({ markers, alpha }) => {
      ctx.globalAlpha = s.opacity * alpha;
      markers.forEach((m) => {
        if (!isVisible(projection, m.coords)) return;
        const [x, y] = projection(m.coords);
        // `dot: false` gives a label with no locator dot, for chapters zoomed
        // close enough that the shape on the globe already locates itself
        const dot = m.dot !== false;
        const r = dot ? (m.radius || 4) : 0;
        if (dot) {
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = m.color || COLORS.marker; ctx.fill();
          ctx.lineWidth = 1.2; ctx.strokeStyle = COLORS.markerRing; ctx.stroke();
        }

        if (m.label) {
          const [dx, dy] = m.labelOffset || [r + 6, 4];
          const lx = x + dx, ly = y + dy;
          if (dot && (Math.abs(dx) > r + 10 || Math.abs(dy) > r + 10)) {
            ctx.beginPath(); ctx.moveTo(x, y);
            ctx.lineTo(lx - (dx > 0 ? 4 : -4), ly - 4);
            ctx.strokeStyle = 'rgba(252,252,252,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
          }
          ctx.font = '600 12px "Public Sans", Helvetica, Arial, sans-serif';
          ctx.textAlign = !dot && dx === 0 ? 'center' : (dx < 0 ? 'right' : 'left');
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(11,28,31,0.75)';
          ctx.strokeText(m.label, lx, ly);
          ctx.fillStyle = m.color || COLORS.habitatLabel;
          ctx.fillText(m.label, lx, ly);
          ctx.textAlign = 'left';
        }
      });
      });

      // --- track timeline --------------------------------------------
      // A rule with a running head and the month the clock has reached. It is
      // a reading aid for the chapter that draws the tracks on, so chapters
      // that simply hold the finished tracks set `timeline: 0`.
      if (s.layer.timeline > 0.001 && d.span) {
        const a = s.opacity * s.layer.timeline;
        const barW = Math.min(420, w * 0.62);   // adjust timeline width here
        const bx = (w - barW) / 2;
        // On a phone the story card occupies the bottom of the screen, so the
        // readout goes to the top of the globe instead of under it.
        const by = w < 768 ? 96 : h - 72;       // adjust timeline height here

        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx + barW, by);
        ctx.strokeStyle = COLORS.timelineRule; ctx.lineWidth = 2; ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx + barW * p, by);
        ctx.strokeStyle = COLORS.timeline; ctx.lineWidth = 2; ctx.stroke();

        ctx.beginPath();
        ctx.arc(bx + barW * p, by, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.timeline; ctx.fill();

        ctx.font = '600 13px "Public Sans", Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(11,28,31,0.75)';
        ctx.strokeText(monthYear(clock), w / 2, by - 14);
        ctx.fillStyle = COLORS.markerRing;
        ctx.fillText(monthYear(clock), w / 2, by - 14);

        // the span's endpoints, so the middle reading has a scale
        ctx.font = '500 11px "Public Sans", Helvetica, Arial, sans-serif';
        ctx.globalAlpha = a * 0.7;
        ctx.textAlign = 'left';
        ctx.fillText(monthYear(d.span.t0), bx, by + 18);
        ctx.textAlign = 'right';
        ctx.fillText(monthYear(d.span.t1), bx + barW, by + 18);
        ctx.textAlign = 'left';
        ctx.globalAlpha = s.opacity;
      }

      ctx.restore();
    };

    gsap.ticker.add(draw);
    const onResize = () => draw();
    window.addEventListener('resize', onResize);

    // Exposed for tuning from the console:
    //   __GLOBE__.state.scale = 3; __GLOBE__.draw();
    if (typeof window !== 'undefined') {
      window.__GLOBE__ = { state: stateRef.current, draw, data: dataRef.current };
    }

    return () => {
      gsap.ticker.remove(draw);
      window.removeEventListener('resize', onResize);
      if (typeof window !== 'undefined') delete window.__GLOBE__;
    };
  }, [ready]);

  // --- keyframes: one per chapter that declares a globe block --------
  useEffect(() => {
    if (!ready) return undefined;

    const measure = () => {
      const kf = [];
      (chapters || []).forEach((c) => {
        if (!c.globe || c.globe.show === false) return;
        const el = document.getElementById(c.id);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const top = r.top + window.scrollY;
        kf.push({
          id: c.id,
          g: c.globe,
          // the chapter is "arrived at" when its block sits mid-viewport
          anchor: top + r.height / 2 - viewportOf(canvasRef.current)[1] / 2
        });
      });
      kf.sort((a, b) => a.anchor - b.anchor);

      // precompute which discrete sets are identical between neighbors, so
      // unchanged markers/arcs/highlights are drawn once instead of cross-faded
      for (let i = 0; i < kf.length - 1; i++) {
        kf[i].sameMarkers = same(kf[i].g.markers, kf[i + 1].g.markers);
        kf[i].sameArcs = same(kf[i].g.arcs, kf[i + 1].g.arcs);
        kf[i].sameHighlight = same(kf[i].g.highlight, kf[i + 1].g.highlight);
      }
      keyframesRef.current = kf;
    };

    measure();
    window.addEventListener('resize', measure);
    // fonts and images can shift the layout after first paint
    const t = setTimeout(measure, 1200);
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(t);
    };
  }, [ready, chapters]);

  return <canvas ref={canvasRef} className="story-globe" aria-hidden="true" />;
};

export default Globe;
