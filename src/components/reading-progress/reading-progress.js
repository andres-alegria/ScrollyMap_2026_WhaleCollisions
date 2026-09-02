import React, { useEffect, useRef } from 'react';
import './reading-progress.scss';

/**
 * ReadingProgress
 * --------------------------------------------------------------------
 * Thin fixed bar at the top of the viewport that fills left→right as
 * the reader scrolls. Drop it at the top of <App /> and it just works.
 *
 * Why a ref + rAF instead of state?
 *   The bar updates dozens of times per second on a long page. Using
 *   useState would trigger a React re-render on every scroll tick.
 *   Writing to the DOM via a ref inside requestAnimationFrame keeps
 *   the work on the compositor and avoids re-renders entirely.
 *
 * Props:
 *   theme    "light" | "dark" | "mongabay"  (matches Story's theme prop)
 *   color    optional override — any CSS color
 *   height   bar height in px (default 6)
 */
const ReadingProgress = ({ theme = 'mongabay', color, height = 6 }) => {
  const barRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? (doc.scrollTop || window.scrollY) / max : 0;
      if (barRef.current) {
        barRef.current.style.width = (pct * 100).toFixed(2) + '%';
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    update(); // initial paint
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Pin to the VISUAL viewport, not the layout viewport.
  //
  // `position: fixed` anchors to the layout viewport, which on a phone is the
  // page as it looks with the browser toolbar collapsed. Scroll up, the
  // toolbar slides back in, the visual viewport shrinks from the top - and a
  // bar sitting at layout-top:0 ends up underneath that toolbar. Offsetting
  // the bar by visualViewport.offsetTop keeps it against the top of whatever
  // the reader can actually see. Pinch-zoom moves the same offset, so the bar
  // follows there too.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;      // older browsers keep the plain fixed bar

    const pin = () => {
      if (trackRef.current) {
        trackRef.current.style.transform = `translateY(${vv.offsetTop}px)`;
      }
    };

    pin();
    vv.addEventListener('resize', pin);
    vv.addEventListener('scroll', pin);
    return () => {
      vv.removeEventListener('resize', pin);
      vv.removeEventListener('scroll', pin);
    };
  }, []);

  // Inline style only for runtime-controlled values; everything else
  // lives in the SCSS file so themes stay consistent across the app.
  const trackStyle = { height: `${height}px` };
  const barStyle = color ? { background: color } : undefined;

  return (
    <div
      ref={trackRef}
      className={`reading-progress reading-progress--${theme}`}
      style={trackStyle}
      aria-hidden="true"
    >
      <div ref={barRef} className="reading-progress__bar" style={barStyle} />
    </div>
  );
};

export default ReadingProgress;
