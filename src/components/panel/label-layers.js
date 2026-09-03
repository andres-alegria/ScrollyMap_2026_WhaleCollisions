/**
 * The basemap's place labels.
 *
 * They are defined in the Mapbox style, like the traffic: continents,
 * countries, states and settlements, all symbol layers. This module only
 * decides how present they are at a given point in the story. What they say,
 * which language they say it in and how they are set stay in Studio.
 *
 * They are off for the opening, where the subject is the whole basin and a
 * scatter of city names is noise over it, and come up for the habitat
 * chapters, where the reader needs to know which coast they are looking at.
 */

// Matched rather than listed. Studio's place-labels component can be turned on
// and off a layer at a time, and a list here would quietly stop covering one
// the moment it was renamed or another was added.
const isLabel = (layer) => layer.type === 'symbol' && /label/i.test(layer.id);

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Whether the style's layers can be read yet.
//
// NOT map.isStyleLoaded(): that asks whether the style AND every source have
// finished loading, and the whale tracks call setData on a GeoJSON source on
// every scroll frame, so on this map it is false most of the time. Guarding
// paint writes on it silently skipped them. getStyle() only needs the style
// itself, and throws rather than answering while it is still parsing, so the
// question is asked by trying it.
const styleLayers = (map) => {
  if (!map) return null;
  try {
    const s = map.getStyle();
    return s && s.layers ? s.layers : null;
  } catch (e) {
    return null;   // still parsing; a later frame will get it
  }
};

// The opacities the style publishes, read once and treated as full strength,
// so a chapter can never make a label more present than Studio says it is.
const baseCache = new WeakMap();
const warned = new Set();

const readBases = (map) => {
  if (baseCache.has(map)) return baseCache.get(map);
  const layers = styleLayers(map);
  if (!layers) return null;          // not cached, so a later frame retries
  const bases = [];
  layers.filter(isLabel).forEach(({ id }) => {
    if (!map.getLayer(id)) return;
    bases.push({
      id,
      // Either can be a zoom expression rather than a number, which is why
      // they are scaled rather than replaced below.
      text: map.getPaintProperty(id, 'text-opacity'),
      icon: map.getPaintProperty(id, 'icon-opacity'),
    });
  });
  baseCache.set(map, bases);
  return bases;
};

/**
 * Scale an opacity by k, whether it is a number or a zoom ramp.
 *
 * NOT by wrapping it as ["*", base, k]. Mapbox rejects a "zoom" expression
 * nested inside another expression - zoom may only appear at the top of a
 * property, or directly inside an interpolate or step - and Studio writes
 * these opacities as zoom ramps, so every one of them is such an expression.
 * The scaling therefore goes on the ramp's output stops, which leaves the
 * shape of the ramp alone: a label that the style fades in between zoom 2 and
 * 3 still does, just to a lower ceiling.
 */
const scale = (base, k) => {
  if (base === undefined || base === null) return k;
  if (typeof base === 'number') return base * k;
  if (!Array.isArray(base)) return k;

  const out = base.slice();
  const num = (i) => typeof out[i] === 'number';
  if (base[0] === 'interpolate' || base[0] === 'interpolate-hcl'
      || base[0] === 'interpolate-lab') {
    // ["interpolate", interpolation, input, stop, output, ...]
    for (let i = 4; i < out.length; i += 2) if (num(i)) out[i] *= k;
    return out;
  }
  if (base[0] === 'step') {
    // ["step", input, output, stop, output, ...]
    for (let i = 2; i < out.length; i += 2) if (num(i)) out[i] *= k;
    return out;
  }
  // Something else - a data-driven expression, say. Fall back to the plain
  // fraction rather than risk writing an invalid property.
  return k;
};

/**
 * Called once the style has loaded. Nothing is added - the layers ship with
 * the style - this only takes their published opacities and hides them, so the
 * story decides when they appear.
 */
export const addLabelLayers = (map) => {
  if (!readBases(map)) return;
  setLabels(map, 0);
};

/**
 * How present the place labels are, 0 to 1, as a fraction of the strength the
 * style gave them.
 */
export const setLabels = (map, amount = 0) => {
  const bases = readBases(map);
  if (!bases) return;
  const k = clamp01(amount);
  bases.forEach(({ id, text, icon }) => {
    if (!map.getLayer(id)) return;
    // Guarded. This runs inside the scroll handler, and Mapbox throws on a
    // paint value it will not accept - which takes down every line after it in
    // that handler, not just the label. It cost the paragraph fades once.
    try {
      map.setPaintProperty(id, 'text-opacity', scale(text, k));
      map.setPaintProperty(id, 'icon-opacity', scale(icon, k));
    } catch (e) {
      if (!warned.has(id)) {
        warned.add(id);
        console.warn(`[labels] ${id} would not take an opacity:`, e.message);
      }
    }
  });
};
