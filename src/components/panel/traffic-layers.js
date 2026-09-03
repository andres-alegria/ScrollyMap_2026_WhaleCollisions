/**
 * The vessel-traffic layers.
 *
 * These are defined in the Mapbox style, not here. Studio owns how they look:
 * circle layers on the `composite` source, filtered on the three speed-band
 * attributes that the tileset carries on every cell:
 *
 *   s   10-15 knots, every cell with any traffic at all   -> Slow_traffic
 *   m   15-25 knots, above 100 vessel-hours               -> Medium_traffic
 *   f   above 25 knots, above 20 vessel-hours             -> Fast_traffic
 *
 * This module only decides how PRESENT each band is at a given point in the
 * story. Colour, radius and stroke stay in Studio, so they can be judged by
 * eye and changed without touching the code. Each layer's published opacity is
 * read once and treated as its full strength; a chapter's value scales that,
 * so a band never renders stronger than the style says it should.
 */

// Layer ids as they are named in the style. Rename them there and these must
// follow, or the traffic silently stops responding to the story.
const BANDS = [
  { key: 'slow', id: 'Slow_traffic' },
  { key: 'mid', id: 'Medium_traffic' },
  { key: 'fast', id: 'Fast_traffic' },
];

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// full strength per layer, taken from the style the first time it is seen
const baseOpacity = new WeakMap();
let warned = false;

const readBase = (map) => {
  if (baseOpacity.has(map)) return baseOpacity.get(map);
  const base = {};
  let missing = [];
  BANDS.forEach(({ key, id }) => {
    if (!map.getLayer(id)) { missing.push(id); return; }
    const o = map.getPaintProperty(id, 'circle-opacity');
    base[key] = typeof o === 'number' ? o : 1;
  });
  if (missing.length && !warned) {
    warned = true;
    // Not thrown: the story should still run with a plain basemap rather than
    // dying because a layer was renamed in Studio.
    console.warn('[traffic] layers missing from the style:', missing.join(', '));
  }
  baseOpacity.set(map, base);
  return base;
};

/**
 * Called once the style has loaded. There is nothing to add any more, since
 * the layers ship with the style; this just takes their published opacities
 * and then hides them, so the story decides when each one appears.
 */
export const addTrafficLayers = (map) => {
  if (!map) return;
  readBase(map);
  setTraffic(map, {});
};

/**
 * The color Studio gave each band, so a legend can label the bands without
 * restating their colors. Hardcoding them somewhere else is how a legend comes
 * to disagree with the map it belongs to.
 *
 * Returns null until the style has loaded.
 */
export const trafficColors = (map) => {
  // Not isStyleLoaded(): it also waits on every source, and a source that is
  // rewritten each frame keeps it false. The layer being there is the only
  // thing this needs.
  if (!map || !map.getLayer(BANDS[0].id)) return null;
  const out = {};
  let found = false;
  BANDS.forEach(({ key, id }) => {
    if (!map.getLayer(id)) return;
    const c = map.getPaintProperty(id, 'circle-color');
    if (typeof c === 'string') { out[key] = c; found = true; }
  });
  return found ? out : null;
};

/**
 * Set how present each band is, 0 to 1, as a fraction of the strength Studio
 * gave it.
 */
export const setTraffic = (map, { slow = 0, mid = 0, fast = 0 } = {}) => {
  if (!map) return;
  const base = readBase(map);
  const want = { slow, mid, fast };
  BANDS.forEach(({ key, id }) => {
    if (!map.getLayer(id)) return;
    map.setPaintProperty(id, 'circle-opacity', clamp01(want[key]) * (base[key] ?? 1));
  });
};
