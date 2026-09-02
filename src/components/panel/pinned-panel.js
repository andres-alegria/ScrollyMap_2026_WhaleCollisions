import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ScaleBar from './scale-bar';
import LocatorGlobe from './locator-globe';
import './pinned-panel.css';

gsap.registerPlugin(ScrollTrigger);

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ScrollTrigger measures each section once at mount; web fonts arriving later
// reflow the cards and leave those measurements stale.
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
 * A full-viewport section holding a fixed image panel on the left and a text
 * column on the right. The panel stays put while the reader scrolls; the
 * image inside it and the paragraph beside it change together, step by step.
 *
 * Adapted from the AreaReveal stage in the isolated-peoples scrolly. Two
 * differences: steps here carry their own paragraph as well as their own
 * image, and the number of steps is whatever the config supplies rather than
 * a fixed three.
 *
 * Pinning follows GSAP's "pinned panels with overscroll" pattern:
 * pinSpacing:false, so no pin-spacer is inserted and the document keeps its
 * natural flow - the next section simply scrolls up over this one. A spacer
 * would make the container re-solve its layout every time a pin engages or
 * releases, which reads as the panel snapping.
 */
const PinnedPanel = ({
  steps = [],
  scale = {},
  locator,
  place,
  title,
  eyebrow,
  aspect = '1 / 1',     // adjust the panel's shape; the Mediterranean wants a wide one
  dwell = 1.4,          // adjust: extra screen-heights per step
  recedeFrom = 0.82,    // adjust: when the section starts giving way
}) => {
  const sectionRef = useRef(null);
  const imgRefs = useRef([]);
  const textRefs = useRef([]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !steps.length) return undefined;

    // Room to scroll through the steps. One screen-height per step beyond the
    // first, times dwell, so a two-step panel is not raced through.
    const hold = Math.max(1, steps.length - 1) * dwell;
    section.style.marginBottom = `${hold * 100}vh`;

    const preload = ScrollTrigger.create({
      trigger: section,
      start: 'top bottom+=120%',
      once: true,
      onEnter: () => {
        // A panel that pins for two screen-heights must not still be fetching
        // its image when it gets there: a blank pinned frame reads as the page
        // being stuck. So these are fetched a viewport ahead, not lazily.
        steps.forEach((s) => { if (s.image) { const im = new Image(); im.src = s.image; } });
      },
    });

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
      onUpdate: (self) => {
        const p = self.progress;
        // Steps share the stretch before the section starts receding. Each
        // gets a window; the crossfade happens in the first third of it so the
        // step is then held, rather than being in permanent transition.
        const n = steps.length;
        const span = recedeFrom / n;
        for (let i = 0; i < n; i++) {
          const startAt = i * span;
          const o = i === 0 ? 1 : clamp01((p - startAt) / (span * 0.34));
          if (imgRefs.current[i]) imgRefs.current[i].style.opacity = String(o);
          if (textRefs.current[i]) {
            textRefs.current[i].style.opacity = String(o);
            // lift very slightly into place, so the change is felt
            textRefs.current[i].style.transform = `translateY(${(1 - o) * 8}px)`;
          }
        }
        const r = clamp01((p - recedeFrom) / (1 - recedeFrom));
        // Promote only while this is actually moving. Left on permanently it
        // costs a full-viewport compositor layer per section.
        const wantsLayer = r > 0;
        if (wantsLayer !== promoted) {
          promoted = wantsLayer;
          section.style.willChange = wantsLayer ? 'transform, opacity' : '';
        }
        section.style.transform = `scale(${1 - 0.08 * r})`;
        section.style.opacity = String(1 - 0.45 * r);
      },
    });

    refreshWhenSettled();
    return () => { st.kill(); preload.kill(); };
  }, [steps, dwell, recedeFrom]);

  if (!steps.length) return null;

  return (
    <section className="panel-section" ref={sectionRef}>
      {(eyebrow || title) && (
        <h3 className="panel-section__title font-lora">
          {eyebrow && <span className="panel-section__eyebrow">{eyebrow}</span>}
          {title && <span className="panel-section__name">{title}</span>}
        </h3>
      )}

      <div className="panel-section__body">
        <div className="panel-section__panel">
          <div className="panel-section__frame" style={{ aspectRatio: aspect }}>
            {steps.map((s, i) => (
              <img
                key={s.image || i}
                className="panel-section__img"
                ref={(el) => { imgRefs.current[i] = el; }}
                src={s.image}
                alt={s.alt || ''}
                style={{ opacity: i === 0 ? 1 : 0 }}
              />
            ))}
            <ScaleBar {...scale} />
            <LocatorGlobe center={locator} place={place} />
          </div>
        </div>

        {/* Steps are stacked on top of each other so the column does not
            change height as they swap; only one is opaque at a time. */}
        <div className="panel-section__card">
          <div className="panel-section__steps">
            {steps.map((s, i) => (
              <div
                key={s.image || i}
                className="panel-section__step"
                ref={(el) => { textRefs.current[i] = el; }}
                style={{ opacity: i === 0 ? 1 : 0 }}
              >
                {s.label && <p className="panel-section__label">{s.label}</p>}
                {s.text && (
                  <p className="panel-section__text"
                     dangerouslySetInnerHTML={{ __html: s.text }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PinnedPanel;
