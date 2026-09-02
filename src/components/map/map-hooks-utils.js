export const layerTypes = {
  fill: ['fill-opacity'],
  line: ['line-opacity'],
  circle: ['circle-opacity', 'circle-stroke-opacity'],
  symbol: ['icon-opacity', 'text-opacity'],
  raster: ['raster-opacity'],
  heatmap: ['heatmap-opacity'],
  'fill-extrusion': ['fill-extrusion-opacity']
};

const getLayerPaintType = (layer, map) => {
  const mapLayer = map.getLayer(layer);
  if (!mapLayer) return [];
  const layerType = map.getLayer(layer).type;
  return layerTypes[layerType];
};

const setLayerOpacity = (layer, map) => {
  const paintProps = getLayerPaintType(layer.layer, map);
  if (!paintProps?.length) return;
  paintProps.forEach((prop) => {
    map.setPaintProperty(layer.layer, prop, layer.opacity);
  });
};

export const setOpacityOnAction = (
  chapter,
  action,
  map,
  externalLayersOpacity,
  setExternalLayersOpacity,
  externalLayersIds
) => {
  const updatedExternalLayersOpacity = { ...externalLayersOpacity };

  // ✅ always an array (stage chapters won’t have onChapterEnter/Exit etc.)
  const actionList = Array.isArray(chapter?.[action]) ? chapter[action] : [];

  // External layers (opacity tracked in state)
  actionList.forEach((layer) => {
    if (!layer || !layer.layer) return; // ignore callback/invalid steps
    if (externalLayersIds.includes(layer.layer)) {
      updatedExternalLayersOpacity[layer.layer] = layer.opacity;
    }
  });

  setExternalLayersOpacity(updatedExternalLayersOpacity);

  // Mapbox internal layers
  actionList
    .filter((layer) => layer && layer.layer && !externalLayersIds.includes(layer.layer))
    .forEach((layer) => setLayerOpacity(layer, map));
};

