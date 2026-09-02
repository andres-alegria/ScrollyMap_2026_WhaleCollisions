import { useEffect, useState } from 'react';
import { setOpacityOnAction } from './map-hooks-utils';

// Chapter scroll controller
//
// Key config knobs to know (in config.js, per chapter):
// - location: { center: [lon, lat], zoom, pitch, bearing, ... }
// - mapAnimation: controls how the chapter moves the camera
//     "flyTo"  (default) -> animated flight
//     "easeTo"           -> smooth ease
//     "jumpTo"           -> instant jump (no animation)
//   Any other value falls back to "flyTo".
//
// NOTE: if a chapter triggers trackAnimation.start with camera != "chapter",
// we skip the chapter camera move to avoid fighting the animation camera.

export const useScrollFunctionality = ({
  loaded,
  map,
  currentAction,
  chapters,
  currentChapterId,
  showMarkers,
  setMarkerPosition,
  setExternalLayersOpacity,
  externalLayersOpacity,
  externalLayers
}) => {
  // Apply the first chapter's onChapterEnter as soon as the map loads.
  // Without this, Mapbox renders all layers at their default style opacity
  // until the first Waypoint fires (when the user scrolls to chapter 1),
  // causing a brief flash of layers that should start hidden.
  useEffect(() => {
    if (!loaded || !map) return;
    const firstChapter = chapters?.[0];
    if (!firstChapter) return;

    const externalLayersIds = (externalLayers || []).map((l) => l.id);
    setOpacityOnAction(
      firstChapter,
      'onChapterEnter',
      map,
      {},
      setExternalLayersOpacity,
      externalLayersIds
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, map]); // intentionally run only once on map load

  useEffect(() => {
    if (!loaded || !map) return;

    const externalLayersIds = (externalLayers || []).map((l) => l.id);

    // Resolve a string callback like "trackAnimation.start" -> window.trackAnimation.start
    const resolveCallback = (callbackStr) =>
      callbackStr
        .split('.')
        .reduce((o, k) => (o ? o[k] : undefined), window);

    // Should the chapter system control the camera?
    // Track animation can take over the camera, depending on its camera mode.
    const shouldChapterControlCamera = (chapter) => {
      const enters = chapter?.onChapterEnter || [];
      const trackStartStep = enters.find(
        (s) => s && s.callback === 'trackAnimation.start'
      );

      if (!trackStartStep) return true; // no track animation, normal chapter camera

      const cam = trackStartStep?.options?.camera;

      // If the chapter sets a camera mode that is NOT "chapter",
      // we must NOT flyTo the chapter location here (it overrides track camera logic).
      if (cam && cam !== 'chapter') return false;

      return true;
    };

    // Apply chapter location with a configurable Mapbox camera method.
    const applyChapterLocation = (chapter) => {
      if (!chapter?.location) return;

      const method = chapter.mapAnimation || 'flyTo';

      // Mapbox GL JS supports flyTo/easeTo/jumpTo with the same options object.
      // - flyTo: animated flight
      // - easeTo: smooth ease
      // - jumpTo: instant update
      const fn =
        method === 'easeTo'
          ? map.easeTo
          : method === 'jumpTo'
            ? map.jumpTo
            : map.flyTo;

      fn.call(map, chapter.location);
    };

    if (currentChapterId && currentAction === 'enter') {
      const chapter = (chapters || []).find((c) => c.id === currentChapterId);
      if (!chapter) return;

      if (chapter.location && shouldChapterControlCamera(chapter)) {
        applyChapterLocation(chapter);
      }

      // Markers: your "center" is [lon, lat]
      if (showMarkers && chapter.location && Array.isArray(chapter.location.center)) {
        const [markerLongitude, markerLatitude] = chapter.location.center;
        setMarkerPosition({
          latitude: markerLatitude,
          longitude: markerLongitude
        });
      }

      setOpacityOnAction(
        chapter,
        'onChapterEnter',
        map,
        externalLayersOpacity,
        setExternalLayersOpacity,
        externalLayersIds
      );

      // Run optional callbacks in onChapterEnter
      (chapter.onChapterEnter || [])
        .filter((s) => s && s.callback)
        .forEach((s) => {
          const fn = resolveCallback(s.callback);
          if (typeof fn === 'function') fn(s.options);
        });
    }

    if (currentChapterId && currentAction === 'leave') {
      const chapter = (chapters || []).find((c) => c.id === currentChapterId);
      if (!chapter) return;

      setOpacityOnAction(
        chapter,
        'onChapterExit',
        map,
        externalLayersOpacity,
        setExternalLayersOpacity,
        externalLayersIds
      );

      // Run optional callbacks in onChapterExit
      (chapter.onChapterExit || [])
        .filter((s) => s && s.callback)
        .forEach((s) => {
          const fn = resolveCallback(s.callback);
          if (typeof fn === 'function') fn(s.options);
        });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, map, currentAction, currentChapterId]);
};

export const useHandleResize = (callback) => {
  const [size, setSize] = useState([0, 0]);

  useEffect(() => {
    const getSize = () => {
      if (size[0] !== window.innerWidth || size[1] !== window.innerHeight) {
        callback({ width: window.innerWidth, height: window.innerHeight });
        setSize([window.innerWidth, window.innerHeight]);
      }
    };

    getSize();
    window.addEventListener('resize', getSize);
    return () => window.removeEventListener('resize', getSize);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return size;
};
