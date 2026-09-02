import { createElement, useEffect, useState } from 'react';
import MapComponent from './map-component';
import externalLayers from './map-external-layers';
import { parsedLayerConfig } from './map-parser';

const parseExternalLayers = (layers) =>
  layers.map((layerConfig) => parsedLayerConfig(layerConfig));

// Fetch a Resource Watch layer definition (dataset -> first layer).
// If the fetch fails, return null so the app can continue without breaking.
const fetchExternalLayer = async (layer) => {
  const { id, slug, decodeParams, decodeFunction } = layer;
  const url = `https://api.resourcewatch.org/v1/dataset/${id}/layer`;

  try {
    const layersResponse = await fetch(url);
    if (!layersResponse) return null;

    const layerBody = await layersResponse.json();

    return layerBody.data && layerBody.data.length
      ? {
          ...layerBody.data[0],
          id: slug,
          ...(decodeParams && { decodeParams }),
          ...(decodeFunction && { decodeFunction })
        }
      : null;
  } catch (e) {
    console.warn(e);
    return null;
  }
};

const fetchExternalLayers = async (layers) => {
  // IMPORTANT:
  // We must filter AFTER Promise.all resolves. Filtering before would filter Promises
  // (always truthy) instead of filtering null results.
  const results = await Promise.all(layers.map((layer) => fetchExternalLayer(layer)));
  return results.filter(Boolean);
};

const Map = (props) => {
  const [parsedExternalLayers, setParsedExternalLayers] = useState([]);

  const resourceWatchExternalLayers = externalLayers.filter(
    (layer) => layer.source === 'resource-watch'
  );
  const notResourceWatchExternalLayers = externalLayers.filter(
    (layer) => layer.source !== 'resource-watch'
  );

  useEffect(() => {
    const setExternalLayers = async () => {
      // Fast path: no RW layers, just parse whatever is in map-external-layers.js
      if (!resourceWatchExternalLayers.length) {
        setParsedExternalLayers(parseExternalLayers(externalLayers));
        return;
      }

      // RW path: fetch live layer definitions and then parse into Mapbox config.
      const resourceWatchLayers = await fetchExternalLayers(resourceWatchExternalLayers);

      setParsedExternalLayers(
        parseExternalLayers([...resourceWatchLayers, ...notResourceWatchExternalLayers])
      );
    };

    setExternalLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createElement(MapComponent, {
    ...props,
    externalLayers: parsedExternalLayers
  });
};

export default Map;
