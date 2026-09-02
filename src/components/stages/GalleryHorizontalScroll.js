import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

import "./GalleryHorizontalScroll.css";

gsap.registerPlugin(ScrollTrigger);

export default function GalleryHorizontalScroll() {
  const rootRef = useRef(null);

useEffect(() => {
  const root = rootRef.current;
  if (!root) return;

  const cleanups = []; // <- store listener removals etc.

  const ctx = gsap.context(() => {
    const q = gsap.utils.selector(root);

    // Horizontal scroll section
    const horizontalSections = gsap.utils.toArray(q(".horiz-gallery-wrapper"));
    horizontalSections.forEach((sec) => {
      const pinWrap = sec.querySelector(".horiz-gallery-strip");
      if (!pinWrap) return;

      const refresh = () => {
        
        const pinWrapWidth = pinWrap.scrollWidth;
        const horizontalScrollLength = pinWrapWidth - window.innerWidth;

ScrollTrigger.getAll()
  .filter((t) => t.trigger === sec)
  .forEach((t) => t.kill());

        gsap.to(pinWrap, {
          x: -horizontalScrollLength,
          ease: "none",
          // ScrollTrigger key options:
            // - start/end: controls when the horizontal scroll begins/ends
            // - scrub: links animation to scroll position (true = smooth)
            // - pin: keeps the section fixed while the strip moves
            // - invalidateOnRefresh: recompute sizes on resize
            scrollTrigger: {
            trigger: sec,
            pin: sec,
            scrub: true,
            start: "center center",
            end: () => `+=${pinWrapWidth}`,
            invalidateOnRefresh: true,
          },
        });
      };

      refresh();
      ScrollTrigger.addEventListener("refreshInit", refresh);
      cleanups.push(() => ScrollTrigger.removeEventListener("refreshInit", refresh));
    });

    ScrollTrigger.refresh();
  }, rootRef);

  return () => {
    // remove any listeners we attached manually
    cleanups.forEach((fn) => fn());

    // kill all gsap/ScrollTrigger things created inside this context
    ctx.revert();
  };
}, []);


  return (
    <div className="stage-combo" ref={rootRef}>
      <section id="portfolio">
        <div className="container-fluid">
          <div className="horiz-gallery-wrapper">
            <div className="horiz-gallery-strip">
              <div className="project-wrap">
                <img src="https://imgs.mongabay.com/wp-content/uploads/sites/20/2026/01/29155728/ChinaVessels_Placeholder.png" alt="Intro" />
              </div>
              <div className="project-wrap">
                <img src="https://images.marinetraffic.com/collection/5045822.webp?size=800" alt="Da Yang Hao" />
              </div>
              <div className="project-wrap">
                <img src="https://images.marinetraffic.com/collection/1521684.webp?size=800" alt="Da Yang Yi Hao" />
              </div>
              <div className="project-wrap">
                <img src="https://images.marinetraffic.com/collection/1025626.webp?size=800" alt="Hai Yang Di Zhi Liu Hao" />
              </div>
              <div className="project-wrap">
                <img src="https://images.marinetraffic.com/collection/6161085.webp?size=800" alt="Shen Hai Yi Hao" />
              </div>
              <div className="project-wrap">
                <img src="https://images.marinetraffic.com/collection/2946734.webp?size=800" alt="Xiang Yang Hong 01" />
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
