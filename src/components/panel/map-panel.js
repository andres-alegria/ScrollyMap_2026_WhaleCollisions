import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { addTrafficLayers, setTraffic, trafficColors } from './traffic-layers';
import { addLabelLayers, setLabels } from './label-layers';
import { TRACK, PSSA, HABITAT_LINE } from './story-layers';
import Legend from './panel-legend';
import {
  loadStoryData, addStoryLayers, setHabitats, setTracks, setPssa,
  bboxOf, bboxOfAll,
} from './story-layers';
import ScaleBar from './scale-bar';
import LocatorGlobe from './locator-globe';
import './map-panel.css';

gsap.registerPlugin(ScrollTrigger);

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Config writes clock windows as dates, which are readable; the clock wants
// milliseconds. Parsed once per step, not per frame.
const windowCache = new WeakMap();
const windowOf = (step) => {
  if (!step || !step.clockWindow) return null;
  if (!windowCache.has(step)) {
    windowCache.set(step, step.clockWindow.map((d) => Date.parse(d)));
  }
  return windowCache.get(step);
};
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
// ---- framing a habitat --------------------------------------------
// Web Mercator's vertical coordinate. Latitude is not linear on the screen, so
// the middle of a bounding box's latitude range is not the middle of the frame.
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mercLat = (y) => ((2 * (Math.atan(Math.exp(y)) - Math.PI / 4)) * 180) / Math.PI;

/**
 * The camera that shows a whole habitat inside the frame.
 *
 * A zoom written into the config only frames a shape at one screen size: the
 * frame is min(52vw, 76vh), so the same zoom shows less of the sea on a small
 * window and cuts the ends off the polygon. Fitting it to the frame's actual
 * pixels means the whole outline is visible wherever it is read.
 *
 * The configured zoom is kept as the closest the camera may come, so this can
 * only pull back, never push in past what the story asked for.
 */
const PAD = 0.12;   // adjust the breathing room around a habitat outline

const fitBox = (bbox, W, H, maxZoom) => {
  if (!bbox || !W || !H) return null;
  const [w, s, e, n] = bbox;
  const zLon = Math.log2((360 * W) / (512 * (e - w) * (1 + PAD)));
  const dy = (Math.abs(mercY(n) - mercY(s)) / (2 * Math.PI)) * (1 + PAD);
  const zLat = dy > 0 ? Math.log2(H / (512 * dy)) : maxZoom;
  return {
    center: [(w + e) / 2, mercLat((mercY(n) + mercY(s)) / 2)],
    zoom: Math.min(maxZoom, zLon, zLat),
  };
};

// How much of a move between habitats the tracks are off screen for. The rest
// is the fade at either end: they go out as the camera leaves and come back
// once it has arrived.
const TRACKS_OFF = 0.2;   // adjust the fade at each end of a move

// The tracks are revealed against a clock; month and year is as fine as the
// reveal is honest, given how irregularly the tags reported.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (ms) => {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/**
 * Wrap capitalised words so automatic hyphenation leaves them alone.
 *
 * The prose is justified, which needs hyphens to keep the word spacing even on
 * a column this narrow - but a name broken across a line reads as a mistake
 * rather than as typesetting: Mediter-ranean, Bal-earic, Pela-gos.
 *
 * Every capitalised word rather than a list of names. A list would go stale
 * the first time an editor wrote a new one, and silently: the name would just
 * start breaking. The cost is that the first word of a sentence is not
 * hyphenated either, which is one line break a reader will never miss.
 *
 * Tags are matched first and passed through untouched, so this cannot reach
 * inside `<strong>` or rewrite an attribute.
 */
const NAME_OR_TAG = /(<[^>]*>)|(\b[A-Z][A-Za-z’'-]{3,})/g;
const nameCache = new Map();
const keepNamesWhole = (html) => {
  if (typeof html !== 'string') return html;
  if (!nameCache.has(html)) {
    nameCache.set(html, html.replace(NAME_OR_TAG,
      (m, tag, word) => (tag || `<span class="map-panel__name">${word}</span>`)));
  }
  return nameCache.get(html);
};

// The knot thresholds are what the data was cut on, so they live here; the
// colors come off the Mapbox style at runtime and are filled in below.
const SPEED_ROWS = [
  // The slow band is drawn at a smaller radius than the other two on the map,
  // so its swatch is smaller here too. ---- adjust the slow swatch ----
  { band: 'slow', label: '10-15 knots (18.5-28 km/h)', size: 5 },
  { band: 'mid', label: '15-25 knots (28-46 km/h)' },
  { band: 'fast', label: '>25 knots (>46 km/h)' },
];

const speedItems = (colors) => (colors
  ? SPEED_ROWS
    .filter(({ band }) => colors[band])
    .map(({ band, label, size }) => ({
      mark: 'dot', color: colors[band], label, size,
    }))
  : null);

// The head marks a whale still transmitting at the date on the clock; a track
// that has gone quiet keeps its path and loses its dot. That distinction is
// invisible unless the key names it.
const TRACK_ITEMS = [
  { mark: 'line', color: TRACK, label: 'Tracked whale paths' },
  { mark: 'dot', color: TRACK, label: 'Position in the month shown' },
];

// The designation's own key. One shape, so one row; it says what the outline
// is rather than repeating the chapter heading above it.
const PSSA_ITEMS = [
  { mark: 'box', color: PSSA, label: 'Boundary designated by the IMO, 2023' },
  // The habitat outlines are held on this map so the reader can see the
  // designation contain them, which is what the paragraph claims. Two kinds
  // of outline on one map need two rows, or the second reads as a mistake.
  { mark: 'box', color: HABITAT_LINE, label: 'Key whale habitat' },
];

// What a traffic mark stands for. The bands are speed classes, not counts, so
// a key naming three speeds without saying what a mark is leaves the reader to
// guess whether it is an average, a maximum, or one ship. "Peak" is the word
// doing that work: the three bands are separate attributes on the same cell
// and the layers stack, so a cell is drawn in every band it qualifies for and
// what shows is the topmost. Of 7,006 cells sampled off the tileset, all 1,835
// carrying the 15-25 or 25+ attribute carried the 10-15 one as well - slower
// traffic crossed nearly every cell on the map.
const SPEED_FOOT = 'Each dot represents a 10-by-10-km patch of sea showing the '
  + 'peak vessel speed category recorded in 2025, as measured by Global Fishing '
  + 'Watch cumulative presence hours.';

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
  dwell = 1.6,          // adjust: screen-heights of scroll per unit of span
  recedeFrom = 0.9,     // adjust: when the section starts giving way
}) => {
  const sectionRef = useRef(null);
  const frameRef = useRef(null);
  const cardRef = useRef(null);
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const textRefs = useRef([]);
  const noteRefs = useRef([]);
  const [scale, setScale] = useState(null);
  const [locator, setLocator] = useState(steps[0] ? steps[0].center : null);
  const [place, setPlace] = useState(steps[0] ? steps[0].place : '');
  // the month the whale-track clock is showing, or null when it is not running
  const [stamp, setStamp] = useState(null);
  // habitats and tracks arrive over the network; scroll may already be running
  const dataRef = useRef(null);
  // the legend takes its swatch colors from the style, so it cannot disagree
  // with the layers it describes
  const [bandColors, setBandColors] = useState(null);
  // fitted cameras, keyed by habitat and frame size
  const fitRef = useRef({ key: '', by: new Map() });
  // one opacity per key, so they cross rather than swap
  const [legend, setLegend] = useState({ speed: 0, tracks: 0, pssa: 0 });
  // the locator is opt-in per step; see LocatorGlobe
  const [locatorOn, setLocatorOn] = useState(steps[0] && steps[0].locator ? 1 : 0);

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
    if (typeof window !== 'undefined') window.__MAP__ = map;

    let alive = true;
    const onLoad = () => {
      map.resize();
      publishFrameHeight();
      publishProseHeight();
      addTrafficLayers(map);
      addLabelLayers(map);
      // the layers start invisible, so paint the first step's state at once
      // rather than waiting for the first scroll
      if (steps[0] && steps[0].traffic) setTraffic(map, steps[0].traffic);
      setLabels(map, (steps[0] && steps[0].labels) || 0);
      // Read once here, and again on `idle` until it answers. The style can
      // arrive without the traffic layers - a cached copy, or one still
      // settling - and a single attempt that came back empty left bandColors
      // null for the session, which silently removed the speed key from the
      // page altogether rather than just leaving it uncoloured.
      const readColors = () => {
        if (!alive) return true;
        const c = trafficColors(map);
        if (!c) return false;
        setBandColors(c);
        return true;
      };
      if (!readColors()) {
        const retry = () => { if (readColors()) map.off('idle', retry); };
        map.on('idle', retry);
      }
      const k0 = steps[0] && steps[0].legend;
      setLegend({
        speed: k0 === 'speed' ? 1 : 0,
        tracks: k0 === 'tracks' ? 1 : 0,
        pssa: k0 === 'pssa' ? 1 : 0,
      });
      // The habitats and the tracks are fetched, so they land after the first
      // scroll frames have already run. Nothing is drawn until they do; the
      // next frame picks them up.
      loadStoryData().then((data) => {
        if (!alive || !mapRef.current) return;
        dataRef.current = data;
        addStoryLayers(map, data);
        const s0 = steps[0] || {};
        setHabitats(map, s0.habitats || 0, s0.habitat || null);
        setPssa(map, s0.pssa || 0);
        setTracks(map, data, {
          amount: s0.tracks || 0, clock: s0.clock || 0, window: windowOf(s0),
        });
        publishFrameHeight();
        publishProseHeight();
        // the cameras could not be fitted until the outlines were here
        ScrollTrigger.update();
      });
      setScale(scaleFor(map, frameRef.current ? frameRef.current.clientWidth : 0));
      // the section's height depends on nothing the map does, but its
      // measurements were taken before the frame had content
      ScrollTrigger.refresh();
    };
    map.on('load', onLoad);

    // The frame takes its height from the text column, so their top and bottom
    // edges line up at any window size. CSS cannot read one box's height from
    // another, and stretch plus a percentage height loops - the frame would
    // resolve against a column the frame is itself stretching - so the column
    // is measured here and published as a length.
    //
    // Only on the wide layout. Stacked, the frame has a shape of its own and
    // the variable is cleared so the CSS aspect ratio applies.
    const stackedQuery = window.matchMedia('(max-width: 820px)');

    /**
     * How tall the prose block has to be, stacked.
     *
     * On a phone the heading and the note stop being two rows and share one
     * cell, the heading at its top and the note at its foot. Two rows reserved
     * the tallest heading AND the tallest note on every chapter, including the
     * five that have no note - 73px of nothing, which on a 667px screen was
     * part of why the key was cut in half.
     *
     * Overlaid, the cell only has to be as tall as the tallest heading, except
     * where a chapter has both: there it has to be the heading's own text plus
     * the note under it. Measured rather than guessed, because both depend on
     * how the type wraps at this width - the whale chapters' text ends 6px
     * below where a bottom-aligned note would start at 375px wide, and that
     * margin changes with every screen.
     */
    const NOTE_GAP = 8;     // adjust the space between a paragraph and its note
    const publishProseHeight = () => {
      const section = sectionRef.current;
      if (!section) return;
      if (!stackedQuery.matches) {
        section.style.removeProperty('--prose-h');
        return;
      }
      const stepsCell = section.querySelector('.map-panel__steps');
      const notesCell = section.querySelector('.map-panel__notes');
      if (!stepsCell) return;
      let need = stepsCell.getBoundingClientRect().height;
      const notesH = notesCell ? notesCell.getBoundingClientRect().height : 0;
      if (notesH > 0) {
        const top = stepsCell.getBoundingClientRect().top;
        steps.forEach((step, k) => {
          if (!step.note) return;
          // The steps share a cell, so a step's own box is the cell's height;
          // its last child is where its text actually ends.
          const el = textRefs.current[k];
          const last = el && el.lastElementChild;
          if (!last) return;
          const bottom = last.getBoundingClientRect().bottom - top;
          need = Math.max(need, bottom + NOTE_GAP + notesH);
        });
      }
      if (need > 0) section.style.setProperty('--prose-h', `${Math.ceil(need)}px`);
    };

    const publishFrameHeight = () => {
      const card = cardRef.current;
      const section = sectionRef.current;
      if (!card || !section) return;
      if (stackedQuery.matches) {
        section.style.removeProperty('--frame-h');
        return;
      }
      const h = Math.round(card.scrollHeight);
      // A zero here means the column has not been laid out yet; publishing it
      // would collapse the frame, and nothing would necessarily measure again.
      if (h > 0) section.style.setProperty('--frame-h', `${h}px`);
    };

    const ro = new ResizeObserver(() => {
      map.resize();
      publishFrameHeight();
      publishProseHeight();
      setScale(scaleFor(map, frameRef.current ? frameRef.current.clientWidth : 0));
      // the fitted cameras were computed against the old frame
      ScrollTrigger.update();
    });
    if (frameRef.current) ro.observe(frameRef.current);
    if (cardRef.current) ro.observe(cardRef.current);

    // The observer alone is not enough. It can fire once while the pane is
    // still narrow - the stacked branch then clears the variable - and never
    // again if the column's own box does not change afterwards. So the height
    // is also published on the next frame, on resize, and when the layout
    // crosses the stacked breakpoint.
    const publishHeights = () => { publishFrameHeight(); publishProseHeight(); };
    const frame = requestAnimationFrame(publishHeights);
    window.addEventListener('resize', publishHeights);
    stackedQuery.addEventListener('change', publishHeights);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', publishHeights);
      stackedQuery.removeEventListener('change', publishHeights);
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

    // Consecutive steps can carry the same words: the whale chapter is six
    // steps and one paragraph, because the map has six things to do while the
    // text has one. Crossfading between them would dim the type six times over
    // for a reader who is looking at a paragraph that never changes. So steps
    // are grouped into runs by what they say, and a run is drawn once, by its
    // first step, and stays up for as long as any step in it is current.
    //
    // The heading and the note are grouped separately, because they change on
    // different beats: the whale chapter keeps one heading across all six of
    // its steps while the note changes once per habitat. Grouped together, a
    // note changing would have faded the heading with it.
    const group = (keyOf) => {
      const of = steps.map(() => 0);
      const runs = [];
      steps.forEach((st, k) => {
        const prev = runs[runs.length - 1];
        if (prev && keyOf(steps[k - 1]) === keyOf(st)) prev.last = k;
        else runs.push({ first: k, last: k });
        of[k] = runs.length - 1;
      });
      return { of, runs };
    };
    const heading = group((st) => `${st.eyebrow || ''}|${st.label || ''}|${st.text || ''}`);
    const notes = group((st) => st.note || '');
    // The keys are grouped the same way, and for the same reason: a key has to
    // leave on the same beat as the chapter that owns it. Crossfading them
    // linearly across the interval instead left the speed key still on screen
    // - at nearly half strength - while the whale chapter's heading was
    // already fading in, because the text finishes its change in the first
    // 0.55 of a step while a linear fade takes the whole of it.
    const keys = group((st) => st.legend || '');

    // How present a run is: fully up anywhere inside it, fading either side.
    const runOpacity = (run, p) => clamp01(1 - (p < run.first ? run.first - p
      : p > run.last ? p - run.last : 0) / 0.55);

    // Each interval runs from one step to the next and gets its own share of
    // the scroll, taken from the step it starts at. Without this every
    // interval is the same length, so a transit between two habitats costs the
    // reader as much scrolling as a chapter - which is most of the section
    // once the whale tracks replay three times.
    const spans = steps.slice(0, -1)
      .map((s) => (typeof s.span === 'number' && s.span > 0 ? s.span : 1));
    const total = spans.reduce((a, b) => a + b, 0) || 1;
    const starts = [];
    spans.reduce((acc, w) => { starts.push(acc); return acc + w; }, 0);

    const hold = total * dwell;
    section.style.marginBottom = `${hold * 100}vh`;

    // A step that names a habitat is framed to show all of it; the rest use
    // the camera written in the config. `fit: false` opts out.
    const cameraFor = (step) => {
      const data = dataRef.current;
      const frame = frameRef.current;
      const wants = step.fit === 'pssa' ? 'pssa' : (step.habitat || null);
      if (!wants || step.fit === false || !data || !frame) return step;
      const W = frame.clientWidth;
      const H = frame.clientHeight;
      if (!W || !H) return step;
      const key = `${W}x${H}`;
      if (fitRef.current.key !== key) fitRef.current = { key, by: new Map() };
      const cache = fitRef.current.by;
      const id = `${wants}@${step.zoom}`;
      if (!cache.has(id)) {
        const box = wants === 'pssa'
          ? bboxOfAll(data.pssa)
          : bboxOf(data.habitats, step.habitat);
        cache.set(id, fitBox(box, W, H, step.zoom) || step);
      }
      return cache.get(id);
    };

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
      // The fixed Mongabay mark sits in the corner the key needs on a small
      // screen. It is marked here rather than hidden outright, so the mark
      // still holds the intro and the foot of the piece; only the pinned
      // chapters take it down, and only where the room is actually short -
      // which is the media query's call, not this one's.
      onToggle: (self) => {
        document.body.classList.toggle('map-panel-pinned', self.isActive);
      },
      onUpdate: (self) => {
        const n = steps.length;
        // Progress along the weighted intervals, before the section starts
        // receding, then expressed back in step-index space as i + f so the
        // text crossfade below still reads in whole steps.
        const u = clamp01(self.progress / recedeFrom) * total;
        let i = 0;
        while (i < spans.length - 1 && u >= starts[i] + spans[i]) i += 1;
        const f = spans.length ? clamp01((u - starts[i]) / spans[i]) : 0;
        const p = i + f;
        const a = steps[i] || steps[0];
        const b = steps[i + 1] || a;
        const ca = cameraFor(a);
        const cb = cameraFor(b);

        // The keys, on the same beat as the text above them. A kind is as
        // present as its strongest run, so a key that comes back later in the
        // story is not dimmed by the runs it is absent from. Computed here,
        // ahead of the map, because a key describes the chapter rather than
        // the map - and because the date readout below is gated on the whale
        // chapter's key being the one on screen.
        const legendOpacity = (kind) => {
          let m = 0;
          keys.runs.forEach((run) => {
            if ((steps[run.first].legend || '') !== kind) return;
            m = Math.max(m, runOpacity(run, p));
          });
          return m;
        };
        const sp = legendOpacity('speed');
        const tr = legendOpacity('tracks');
        const ps = legendOpacity('pssa');
        setLegend((prev) => (prev.speed === sp && prev.tracks === tr
          && prev.pssa === ps ? prev : { speed: sp, tracks: tr, pssa: ps }));

        const map = mapRef.current;
        if (map) {
          map.jumpTo({
            center: [lerpLon(ca.center[0], cb.center[0], f), lerp(ca.center[1], cb.center[1], f)],
            zoom: lerp(ca.zoom, cb.zoom, f),
            pitch: lerp(a.pitch || 0, b.pitch || 0, f),
            bearing: lerp(a.bearing || 0, b.bearing || 0, f),
          });
          // the data layers travel with the camera, interpolated the same way,
          // so a band fades in over the same stretch the camera moves
          const ta = a.traffic || {};
          const tb = b.traffic || {};
          const at = (k) => lerp(ta[k] || 0, tb[k] || 0, f);
          setTraffic(map, { slow: at('slow'), mid: at('mid'), fast: at('fast') });

          // The habitat outlines and the whale tracks ride the same
          // interpolation. `clock` is how much of the tagging record has been
          // revealed; two steps sharing a camera turn that into a reveal that
          // plays out while the map holds still.
          const between = (k) => lerp(a[k] || 0, b[k] || 0, f);
          // The focused outline is the nearer step's, so it swaps once rather
          // than crossfading through a filter change mid-move.
          setHabitats(map, between('habitats'), (f < 0.5 ? a : b).habitat || null);
          setPssa(map, between('pssa'));
          setLabels(map, between('labels'));
          // The window belongs to whichever step the reader is nearer. It
          // cannot be interpolated - a clock is built from one - and the two
          // steps of a pass share theirs, so it only changes on a transit,
          // where the tracks have retracted and nothing is on screen to jump.
          // A move between two habitats goes from the end of one replay to the
          // start of the next, so interpolating the clock across it runs it
          // backwards: the paths un-draw themselves and the date counts down,
          // which reads as a fault rather than as a transition. So on a
          // backwards interval the tracks are taken off screen for the move
          // and the clock is held at whichever end the camera is nearer,
          // rather than swept between them. They come back, from the start of
          // the new window, once the camera has arrived.
          const rewinding = (b.clock || 0) < (a.clock || 0);
          const gate = rewinding
            ? Math.max(clamp01(1 - f / TRACKS_OFF),
                       clamp01((f - (1 - TRACKS_OFF)) / TRACKS_OFF))
            : 1;
          const ms = setTracks(map, dataRef.current, {
            amount: between('tracks') * gate,
            clock: rewinding ? (f < 0.5 ? (a.clock || 0) : (b.clock || 0))
              : between('clock'),
            window: windowOf(f < 0.5 ? a : b),
          });
          // Only while the whale chapter is the one being read. The tracks
          // start fading in during the handover out of the Hellenic Trench
          // chapter, and setTracks returns a date the moment they are drawn at
          // all - so the readout used to appear over the habitat chapter,
          // showing May 2021 against a paragraph about the trench. Gated on
          // the same run that decides the key, so it arrives with the chapter
          // that owns it.
          const label = (ms === null || tr <= 0.5) ? null : monthYear(ms);
          setStamp((prev) => (prev === label ? prev : label));
          const loc = lerp(a.locator ? 1 : 0, b.locator ? 1 : 0, f);
          setLocatorOn((prev) => (prev === loc ? prev : loc));
        }

        // Text: each step fades in AND out again. Fading in only would leave
        // every earlier paragraph sitting behind the current one - they are
        // transparent, so they stack rather than cover.
        //
        // Opacity only. The paragraphs used to rise a few pixels as they came
        // in, but that offset is scrubbed to the scroll like everything else
        // here, so it did not read as a rise - it read as the type trembling
        // under the reader's finger for the whole chapter. A block of running
        // text has to hold still to be read.
        // Only the first step of a run draws it; the rest repeat the same
        // words and would double-strike the type.
        for (let k = 0; k < n; k++) {
          const el = textRefs.current[k];
          if (el) {
            const run = heading.runs[heading.of[k]];
            const o = run.first === k ? runOpacity(run, p) : 0;
            el.style.opacity = String(o);
            // an invisible paragraph must not swallow selection or clicks
            el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
          }
          const nel = noteRefs.current[k];
          if (nel) {
            const run = notes.runs[notes.of[k]];
            const o = run.first === k ? runOpacity(run, p) : 0;
            nel.style.opacity = String(o);
            nel.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
          }
        }

        // The globe takes its marker and label from the step that asked for
        // it, not from whichever step is nearest. Otherwise it spends its fade
        // out relabelled for the chapter arriving behind it - the Mediterranean
        // globe was flipping to Spain on its way off screen.
        const owner = (a.locator && a) || (b.locator && b) || steps[Math.round(p)];
        if (owner) {
          if (owner.center) setLocator(owner.center);
          setPlace(owner.place || '');
        }
        // Only when the bar would actually look different. Setting a freshly
        // built object every frame re-renders the panel every frame, for a
        // readout that changes a handful of times in the whole story.
        if (map) {
          const next = scaleFor(map, frameRef.current ? frameRef.current.clientWidth : 0);
          setScale((prev) => (
            prev && next && prev.n === next.n
              && Math.abs(prev.kmFrac - next.kmFrac) < 0.002 ? prev : next
          ));
        }

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
    return () => {
      document.body.classList.remove('map-panel-pinned');
      st.kill();
    };
  }, [steps, dwell, recedeFrom]);

  if (!steps.length) return null;

  return (
    <section className="map-panel" ref={sectionRef}>
      <div className="map-panel__body">
        <div className="map-panel__col">
          {/* The shape goes in as a variable, not as aspectRatio directly, so
              the stacked layout can override it - the tall frame exists to
              match the text column beside it, and stacked there is none. */}
          <div className="map-panel__frame" ref={frameRef} style={{ '--aspect': aspect }}>
            <div className="map-panel__map" ref={mapNodeRef} />
            {scale && <ScaleBar {...scale} />}
            {/* Only on screen while the tracks are being revealed, so the
                frame is not carrying furniture it does not need. */}
            {stamp !== null && <p className="map-panel__stamp">{stamp}</p>}
            <LocatorGlobe center={locator} place={place} opacity={locatorOn} />
          </div>
        </div>

        {/* Steps are stacked in one grid cell so the column keeps a single
            height; only the current one is opaque. */}
        <div className="map-panel__card" ref={cardRef}>
          <div className="map-panel__prose">
            <div className="map-panel__steps">
            {steps.map((s, i) => (
              <div
                // Index, not label: the whale chapter is two steps sharing one
                // camera and one heading, so labels are not unique and React
                // would drop one of them.
                key={i}
                className="map-panel__step"
                ref={(el) => {
                  textRefs.current[i] = el;
                  // Set once, on first paint. After that the scroll handler
                  // owns this: as a React-controlled style prop it would be
                  // reset to the first step on every re-render, which is a
                  // race the handler loses roughly half the time.
                  if (el && !el.dataset.ready) {
                    el.dataset.ready = '1';
                    el.style.opacity = i === 0 ? '1' : '0';
                  }
                }}
              >
                {s.eyebrow && <p className="map-panel__eyebrow">{s.eyebrow}</p>}
                {/* Markup, like the text and the note below it: a heading
                    sometimes needs its own line break, and where it falls is
                    an editorial call rather than whatever the column width
                    happens to do. */}
                {s.label && (
                  <h3 className="map-panel__label font-lora"
                      dangerouslySetInnerHTML={{ __html: s.label }} />
                )}
                {/* A div, not a p: a chapter may run to more than one
                    paragraph, and a <p> cannot contain another. */}
                {s.text && (
                  <div className="map-panel__text"
                       dangerouslySetInnerHTML={{ __html: keepNamesWhole(s.text) }} />
                )}
              </div>
            ))}
            </div>

            {/* The line saying what a particular pass is showing. Its own
                stack, so it can change while the heading above it holds. */}
            <div className="map-panel__notes">
              {steps.map((s, i) => (s.note ? (
                <p
                  key={i}
                  className="map-panel__note"
                  ref={(el) => {
                    noteRefs.current[i] = el;
                    if (el && !el.dataset.ready) {
                      el.dataset.ready = '1';
                      el.style.opacity = '0';
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: keepNamesWhole(s.note) }}
                />
              ) : null))}
            </div>
          </div>

          {/* Pushed to the foot of the column by the steps above it, so it
              lands on the bottom edge of the map frame. Both keys share the
              slot, so swapping one for the other moves nothing. */}
          <div className="panel-legend-stack">
            <Legend
              title="Vessel speed"
              items={speedItems(bandColors)}
              foot={SPEED_FOOT}
              opacity={legend.speed}
            />
            <Legend
              title="Tracked whales"
              items={TRACK_ITEMS}
              opacity={legend.tracks}
            />
            <Legend
              title="PSSA"
              items={PSSA_ITEMS}
              opacity={legend.pssa}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default MapPanel;
