/**
 * The two data layers the story adds on top of the Mapbox style: the three
 * key whale habitats, and the twelve tracked whales.
 *
 * These stay client-side GeoJSON rather than going up to Mapbox as tilesets.
 * The habitats are three polygons, about 7 kB, so a tileset would be all
 * overhead. The tracks have to stay local for a stronger reason: the reveal is
 * driven by a per-vertex timestamp, and clipping a line at a moment in time
 * means rebuilding its geometry every frame. Only a runtime GeoJSON source can
 * be rewritten like that.
 *
 * Everything here is driven the same way the traffic is: a step gives a value
 * between 0 and 1, and values interpolate between steps along with the camera.
 */

// ---- appearance ----------------------------------------------------
// adjust habitat outline color
const HABITAT_LINE = '#FCFCFC';
// adjust habitat fill color (kept very faint; it is a location, not a value)
const HABITAT_FILL = '#FCFCFC';
// adjust whale track color. Matches the reading-progress bar, so the tracks
// read as the thread running through the piece. Exported so the legend labels
// the tracks in the color they are actually drawn in.
export const TRACK = '#BFECB1';
// adjust PSSA color. Its own hue, not the habitats' white: the designation is
// a different kind of thing from the habitats it contains. Exported so its key
// swatch is drawn in the colour the layer actually uses.
export const PSSA = '#74ADB3';

export const SRC_HABITATS = 'story-habitats';
export const SRC_TRACKS = 'story-tracks';
export const SRC_PSSA = 'story-pssa';

const LYR = {
  habitatFill: 'story-habitat-fill',
  habitatLine: 'story-habitat-line',
  habitatFocus: 'story-habitat-focus',
  trackLine: 'story-track-line',
  trackHead: 'story-track-head',
  pssaFill: 'story-pssa-fill',
  pssaLine: 'story-pssa-line',
};

const EMPTY = { type: 'FeatureCollection', features: [] };
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---- the time clock ------------------------------------------------
// The share of the scroll each silence in the record gets. See trackSpan.
const GAP_SHARE = 0.04;   // adjust how fast the quiet months pass

const timesOf = (f) => (
  f.properties
  && f.properties.coordinateProperties
  && f.properties.coordinateProperties.times
) || null;

// cut a segment at a boundary that falls inside it
const splitAt = (segs, t) => {
  const out = [];
  segs.forEach((x) => {
    if (t > x.t0 && t < x.t1) {
      out.push({ ...x, t1: t }, { ...x, t0: t });
    } else {
      out.push(x);
    }
  });
  return out;
};

/**
 * The clock that drives the reveal.
 *
 * A straight t0..t1 clock does not work with real tagging data. The twelve
 * whales transmit on 167 of the 1,234 days the record spans, in four short
 * summer bursts with year-long silences between them, so a linear reveal sits
 * frozen for most of the chapter and then lurches.
 *
 * So the clock is piecewise. Silences get a small fixed slice each; the
 * windows where a whale is actually transmitting share the rest. The reveal
 * stays continuous and the date readout stays truthful - it simply sweeps
 * through each winter quickly instead of stopping dead.
 *
 * `focus` cuts the clock down to one habitat's own window. The tracks are
 * replayed once per habitat and the whales were not in all three at the same
 * time: one reached the Hellenic Trench, and only in the last weeks of a
 * record spanning three years. Run across the whole record, that pass counted
 * months in which nothing was drawn - the readout showed May 2021 over an
 * empty sea - and then ran past its own window to September 2024, which
 * contradicted the sentence beside it. Focused, it starts and ends on the
 * dates the sentence names.
 *
 * Returns { t0, t1, at(progress) -> ms }.
 */
export const trackSpan = (fc, focus = null) => {
  const spans = [];
  (fc.features || []).forEach((f) => {
    const t = timesOf(f);
    if (t && t.length) spans.push([t[0], t[t.length - 1]]);
  });
  if (!spans.length) return null;
  spans.sort((a, b) => a[0] - b[0]);

  // merge overlapping transmission windows
  const live = [spans[0].slice()];
  spans.slice(1).forEach(([s, e]) => {
    const last = live[live.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else live.push([s, e]);
  });

  let t0 = live[0][0];
  let t1 = live[live.length - 1][1];

  // one segment per transmitting window and per silence
  let segs = [];
  live.forEach(([s, e], i) => {
    if (i > 0) segs.push({ t0: live[i - 1][1], t1: s, gap: true });
    segs.push({ t0: s, t1: e, gap: false });
  });

  // A focus boundary can fall in the middle of a segment, so cut there first;
  // every segment is then wholly inside the window or wholly outside it, and
  // the outside ones are dropped. The window becomes the whole clock.
  if (focus) {
    const [f0, f1] = focus;
    segs = splitAt(splitAt(segs, f0), f1).filter((x) => x.t0 >= f0 && x.t1 <= f1);
    if (!segs.length) return null;
    t0 = f0;
    t1 = f1;
  }

  // Silences cost a fixed slice each; the transmitting windows share what is
  // left, in proportion to their length.
  const gaps = segs.filter((x) => x.gap);
  const gapTotal = Math.min(0.5, gaps.length * GAP_SHARE);
  const liveSegs = segs.filter((x) => !x.gap);
  const liveTotal = 1 - gapTotal;
  const liveMs = liveSegs.reduce((n, x) => n + (x.t1 - x.t0), 0);
  liveSegs.forEach((x) => {
    x.w = liveMs > 0
      ? liveTotal * ((x.t1 - x.t0) / liveMs)
      : liveTotal / Math.max(1, liveSegs.length);
  });
  gaps.forEach((x) => { x.w = gaps.length ? gapTotal / gaps.length : 0; });

  let acc = 0;
  segs.forEach((x) => { x.p0 = acc; acc += x.w; x.p1 = acc; });

  const at = (p) => {
    if (p <= 0) return t0;
    if (p >= 1) return t1;
    const seg = segs.find((x) => p <= x.p1) || segs[segs.length - 1];
    const k = seg.w > 0 ? (p - seg.p0) / seg.w : 1;
    return seg.t0 + (seg.t1 - seg.t0) * k;
  };

  return { t0, t1, at };
};

/**
 * A clock per focus window, built once and kept. A pass asks for its own on
 * every scroll frame, and rebuilding the segment list each time would be
 * wasteful for something that only depends on two numbers.
 */
const clockCache = new WeakMap();

export const clockFor = (data, window) => {
  if (!data || !data.tracks) return null;
  if (!window) return data.clock;
  let byWindow = clockCache.get(data);
  if (!byWindow) { byWindow = new Map(); clockCache.set(data, byWindow); }
  const key = `${window[0]}-${window[1]}`;
  if (!byWindow.has(key)) byWindow.set(key, trackSpan(data.tracks, window));
  return byWindow.get(key);
};

// ---- clipping a track at a moment ----------------------------------
const lerp = (a, b, t) => a + (b - a) * t;

// last vertex at or before `ms`; -1 if the whale has not started transmitting
const lastIndexAt = (times, ms) => {
  let lo = 0;
  let hi = times.length - 1;
  if (ms < times[0]) return -1;
  if (ms >= times[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= ms) lo = mid; else hi = mid - 1;
  }
  return lo;
};

/**
 * Rebuild the tracks as they stood at `ms`: every whale's line up to that
 * moment, with the final segment cut part-way so the head moves smoothly
 * between fixes rather than hopping from one to the next.
 *
 * Returns { lines, heads } — the paths, and a point at the end of each live
 * one. A whale that has stopped transmitting keeps its path but loses its
 * head, so the reader can tell which animals are still moving.
 */
export const tracksAt = (fc, ms) => {
  const lines = [];
  const heads = [];
  (fc.features || []).forEach((f) => {
    const times = timesOf(f);
    const coords = f.geometry && f.geometry.coordinates;
    if (!times || !coords || coords.length < 2) return;
    const i = lastIndexAt(times, ms);
    if (i < 0) return;

    const part = coords.slice(0, i + 1);
    let live = false;
    if (i < coords.length - 1) {
      // part-way into the next leg
      const span = times[i + 1] - times[i];
      const k = span > 0 ? clamp01((ms - times[i]) / span) : 0;
      part.push([
        lerp(coords[i][0], coords[i + 1][0], k),
        lerp(coords[i][1], coords[i + 1][1], k),
      ]);
      live = true;
    }
    if (part.length < 2) return;

    const props = { whale_id: f.properties.whale_id };
    lines.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: part } });
    if (live) {
      heads.push({
        type: 'Feature',
        properties: props,
        geometry: { type: 'Point', coordinates: part[part.length - 1] },
      });
    }
  });
  return {
    lines: { type: 'FeatureCollection', features: lines },
    heads: { type: 'FeatureCollection', features: heads },
  };
};

/**
 * The bounding box of one habitat, as [west, south, east, north].
 *
 * Cached: the panel asks for this on every scroll frame to frame the camera,
 * and walking a polygon's rings to answer is not something to do sixty times a
 * second for a shape that never changes.
 */
const bboxCache = new Map();

export const bboxOfAll = (fc) => {
  if (!fc || !fc.features || !fc.features.length) return null;
  let w = 180; let s = 90; let e = -180; let n = -90;
  fc.features.forEach((f) => {
    const rings = f.geometry.type === 'Polygon'
      ? f.geometry.coordinates
      : f.geometry.coordinates.flat();
    rings.forEach((r) => r.forEach(([x, y]) => {
      if (x < w) w = x; if (x > e) e = x;
      if (y < s) s = y; if (y > n) n = y;
    }));
  });
  return [w, s, e, n];
};

export const bboxOf = (habitats, title) => {
  if (!habitats || !title) return null;
  if (bboxCache.has(title)) return bboxCache.get(title);
  const f = (habitats.features || []).find((x) => x.properties.title === title);
  if (!f) return null;
  const rings = f.geometry.type === 'Polygon'
    ? f.geometry.coordinates
    : f.geometry.coordinates.flat();
  let w = 180; let s = 90; let e = -180; let n = -90;
  rings.forEach((r) => r.forEach(([x, y]) => {
    if (x < w) w = x; if (x > e) e = x;
    if (y < s) s = y; if (y > n) n = y;
  }));
  const box = [w, s, e, n];
  bboxCache.set(title, box);
  return box;
};

// ---- loading -------------------------------------------------------
// Fetched once per page, however many maps ask for it.
let dataPromise = null;

export const loadStoryData = () => {
  if (dataPromise) return dataPromise;
  const base = process.env.PUBLIC_URL || '';
  const get = (u) => fetch(`${base}${u}`).then((r) => {
    if (!r.ok) throw new Error(`${u}: ${r.status}`);
    return r.json();
  });
  dataPromise = Promise.all([
    get('/data/habitats.geojson'),
    get('/data/whale_tracks.geojson'),
    get('/data/pssa.geojson'),
  ]).then(([habitats, tracks, pssa]) => ({
    habitats,
    tracks,
    pssa,
    clock: trackSpan(tracks),
  })).catch((e) => {
    dataPromise = null;          // let a later map retry
    console.warn('[story-layers] could not load the data:', e.message);
    return { habitats: EMPTY, tracks: EMPTY, pssa: EMPTY, clock: null };
  });
  return dataPromise;
};

// ---- adding the layers ---------------------------------------------
// The first symbol layer in the style; place lines beneath it so place names
// stay readable on top of them.
const firstSymbol = (map) => {
  let layers = [];
  try { layers = (map.getStyle() || {}).layers || []; } catch (e) { layers = []; }
  const s = layers.find((l) => l.type === 'symbol');
  return s && s.id;
};

/**
 * Add the sources and layers. Safe to call more than once: a hot reload or a
 * style change would otherwise throw on the second source of the same name.
 */
export const addStoryLayers = (map, data) => {
  // Not isStyleLoaded(): see the note in label-layers. Adding a layer only
  // needs the style itself, which addLayer will complain about if it is not
  // there yet - and this is called once, from the load handler.
  if (!map) return;
  const labels = firstSymbol(map);
  const add = (spec, before) => {
    if (map.getLayer(spec.id)) return;
    map.addLayer(spec, before && map.getLayer(before) ? before : undefined);
  };

  if (!map.getSource(SRC_HABITATS)) {
    map.addSource(SRC_HABITATS, { type: 'geojson', data: data.habitats || EMPTY });
  }
  if (!map.getSource(SRC_TRACKS)) {
    map.addSource(SRC_TRACKS, { type: 'geojson', data: EMPTY });
  }
  if (!map.getSource(`${SRC_TRACKS}-heads`)) {
    map.addSource(`${SRC_TRACKS}-heads`, { type: 'geojson', data: EMPTY });
  }
  if (!map.getSource(SRC_PSSA)) {
    map.addSource(SRC_PSSA, { type: 'geojson', data: data.pssa || EMPTY });
  }

  // The PSSA sits under everything the story draws: it is the largest shape on
  // the map by far, and the traffic it is meant to govern has to read on top.
  add({
    id: LYR.pssaFill,
    type: 'fill',
    source: SRC_PSSA,
    paint: { 'fill-color': PSSA, 'fill-opacity': 0 },
  }, map.getLayer('Slow_traffic') ? 'Slow_traffic' : labels);

  add({
    id: LYR.pssaLine,
    type: 'line',
    source: SRC_PSSA,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    // adjust PSSA outline weight
    paint: { 'line-color': PSSA, 'line-width': 2.4, 'line-opacity': 0 },
  }, labels);

  // The fill goes under the traffic: the habitat is the ground the story is
  // about, and the vessels have to read on top of it.
  add({
    id: LYR.habitatFill,
    type: 'fill',
    source: SRC_HABITATS,
    paint: { 'fill-color': HABITAT_FILL, 'fill-opacity': 0 },
  }, map.getLayer('Slow_traffic') ? 'Slow_traffic' : labels);

  // Outlines go over it, so a thin line is not lost in the cells.
  add({
    id: LYR.habitatLine,
    type: 'line',
    source: SRC_HABITATS,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': HABITAT_LINE,
      'line-width': 1,
      'line-dasharray': [3, 3],     // adjust habitat outline dash
      'line-opacity': 0,
    },
  }, labels);

  // The habitat the reader is being shown, drawn solid over the dashed set.
  add({
    id: LYR.habitatFocus,
    type: 'line',
    source: SRC_HABITATS,
    filter: ['==', ['get', 'title'], '__none__'],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': HABITAT_LINE, 'line-width': 1.8, 'line-opacity': 0 },
  }, labels);

  add({
    id: LYR.trackLine,
    type: 'line',
    source: SRC_TRACKS,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': TRACK,
      // adjust whale track weight
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.83, 7, 1.8],
      'line-opacity': 0,
    },
  }, labels);

  add({
    id: LYR.trackHead,
    type: 'circle',
    source: `${SRC_TRACKS}-heads`,
    paint: {
      'circle-color': TRACK,
      // adjust whale position dot size
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3.5, 7, 7],
      'circle-stroke-color': '#181818',
      'circle-stroke-width': 0.6,
      'circle-opacity': 0,
      'circle-stroke-opacity': 0,
    },
  }, labels);
};

/**
 * How present the PSSA is. One shape, so one number.
 */
export const setPssa = (map, amount = 0) => {
  if (!map || !map.getLayer(LYR.pssaLine)) return;
  const a = clamp01(amount);
  map.setPaintProperty(LYR.pssaFill, 'fill-opacity', a * 0.16);
  map.setPaintProperty(LYR.pssaLine, 'line-opacity', a * 0.9);
};

/**
 * How present the habitat outlines are, and which one is being shown.
 */
export const setHabitats = (map, amount = 0, focus = null) => {
  if (!map || !map.getLayer(LYR.habitatLine)) return;
  const a = clamp01(amount);
  map.setPaintProperty(LYR.habitatFill, 'fill-opacity', a * 0.06);
  map.setPaintProperty(LYR.habitatLine, 'line-opacity', a * 0.45);
  map.setPaintProperty(LYR.habitatFocus, 'line-opacity', a);
  map.setFilter(LYR.habitatFocus, ['==', ['get', 'title'], focus || '__none__']);
};

/**
 * How present the tracks are, and how much of the record has been revealed.
 *
 * Returns the moment the clock is showing, in ms, so the caller can put a date
 * on screen; null when there is nothing to show.
 */
export const setTracks = (map, data, { amount = 0, clock = 0, window = null } = {}) => {
  if (!map || !map.getLayer(LYR.trackLine)) return null;
  const a = clamp01(amount);
  map.setPaintProperty(LYR.trackLine, 'line-opacity', a);
  map.setPaintProperty(LYR.trackHead, 'circle-opacity', a);
  map.setPaintProperty(LYR.trackHead, 'circle-stroke-opacity', a);

  const src = map.getSource(SRC_TRACKS);
  const headSrc = map.getSource(`${SRC_TRACKS}-heads`);
  if (!src || !headSrc) return null;

  // Nothing visible: empty the source rather than leaving stale geometry the
  // reader would see flash on the way back down.
  if (a <= 0 || !data || !data.clock) {
    src.setData(EMPTY);
    headSrc.setData(EMPTY);
    return null;
  }

  const span = clockFor(data, window) || data.clock;
  const ms = span.at(clamp01(clock));
  const { lines, heads } = tracksAt(data.tracks, ms);
  src.setData(lines);
  headSrc.setData(heads);
  return ms;
};
