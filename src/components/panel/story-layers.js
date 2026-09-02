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
// read as the thread running through the piece.
const TRACK = '#BFECB1';

export const SRC_HABITATS = 'story-habitats';
export const SRC_TRACKS = 'story-tracks';

const LYR = {
  habitatFill: 'story-habitat-fill',
  habitatLine: 'story-habitat-line',
  habitatFocus: 'story-habitat-focus',
  trackLine: 'story-track-line',
  trackHead: 'story-track-head',
};

const EMPTY = { type: 'FeatureCollection', features: [] };
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---- the time clock ------------------------------------------------
/**
 * A straight t0..t1 clock does not work with real tagging data. The twelve
 * whales transmit on 167 of the 1,234 days the record spans, in four short
 * summer bursts with year-long silences between them, so a linear reveal sits
 * frozen for most of the chapter and then lurches.
 *
 * So the clock is piecewise: the windows where a whale is actually
 * transmitting share most of the progress in proportion to their length, and
 * each silence gets a small fixed slice. The reveal stays continuous and the
 * date readout stays truthful; it simply sweeps through each winter quickly
 * instead of stopping dead. GAP_SHARE is that slice.
 */
const GAP_SHARE = 0.04;   // adjust how fast the quiet months pass

const timesOf = (f) => (
  f.properties
  && f.properties.coordinateProperties
  && f.properties.coordinateProperties.times
) || null;

export const trackSpan = (fc) => {
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

  const t0 = live[0][0];
  const t1 = live[live.length - 1][1];

  // one segment per window and per silence, each with a share of the progress
  const segs = [];
  live.forEach(([s, e], i) => {
    if (i > 0) segs.push({ t0: live[i - 1][1], t1: s, gap: true });
    segs.push({ t0: s, t1: e, gap: false });
  });
  const liveMs = live.reduce((n, [s, e]) => n + (e - s), 0) || 1;
  const gaps = segs.filter((x) => x.gap).length;
  const gapTotal = Math.min(0.5, gaps * GAP_SHARE);
  segs.forEach((x) => {
    x.w = x.gap ? gapTotal / gaps : (1 - gapTotal) * ((x.t1 - x.t0) / liveMs);
  });
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
  ]).then(([habitats, tracks]) => ({
    habitats,
    tracks,
    clock: trackSpan(tracks),
  })).catch((e) => {
    dataPromise = null;          // let a later map retry
    console.warn('[story-layers] could not load the data:', e.message);
    return { habitats: EMPTY, tracks: EMPTY, clock: null };
  });
  return dataPromise;
};

// ---- adding the layers ---------------------------------------------
// The first symbol layer in the style; place lines beneath it so place names
// stay readable on top of them.
const firstSymbol = (map) => {
  const layers = map.getStyle().layers || [];
  const s = layers.find((l) => l.type === 'symbol');
  return s && s.id;
};

/**
 * Add the sources and layers. Safe to call more than once: a hot reload or a
 * style change would otherwise throw on the second source of the same name.
 */
export const addStoryLayers = (map, data) => {
  if (!map || !map.getStyle()) return;
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
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.1, 7, 2.4],
      'line-opacity': 0,
    },
  }, labels);

  add({
    id: LYR.trackHead,
    type: 'circle',
    source: `${SRC_TRACKS}-heads`,
    paint: {
      'circle-color': TRACK,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2, 7, 4],
      'circle-stroke-color': '#181818',
      'circle-stroke-width': 0.6,
      'circle-opacity': 0,
      'circle-stroke-opacity': 0,
    },
  }, labels);
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
export const setTracks = (map, data, { amount = 0, clock = 0 } = {}) => {
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

  const ms = data.clock.at(clamp01(clock));
  const { lines, heads } = tracksAt(data.tracks, ms);
  src.setData(lines);
  headSrc.setData(heads);
  return ms;
};
