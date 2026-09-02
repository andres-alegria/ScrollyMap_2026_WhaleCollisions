import React, { useRef } from 'react';
import cx from 'classnames';
import './chapter.scss';
import { useTranslation } from 'react-i18next';
import { Waypoint } from 'react-waypoint';
import LegendIcon from '../icons/legend-icon';
import { STAGES } from "../stages/stage-registry";


  
// Resolve legend entry from a live Mapbox layer if `fromLayer` is provided
const resolveLegendItem = (l) => {
  const map = typeof window !== 'undefined' ? window.__MAP__ : undefined;
  if (!map || !l?.fromLayer) return l;

  const layer = map.getLayer(l.fromLayer);
  if (!layer) return l;

  const get = (prop) => {
    try { return map.getPaintProperty(l.fromLayer, prop); } catch { return undefined; }
  };

  if (layer.type === 'line') {
    return {
      ...l,
      symbol: 'line',
      color: get('line-color') ?? l.color ?? '#000',
      width: get('line-width') ?? l.width ?? 3,
      dasharray: get('line-dasharray') ?? l.dasharray,
    };
  }
  if (layer.type === 'fill') {
    return {
      ...l,
      symbol: 'fill',
      color: get('fill-color') ?? l.color ?? '#000',
      border: get('fill-outline-color') ?? l.border,
    };
  }
  if (layer.type === 'circle') {
    return {
      ...l,
      symbol: 'circle',
      color: get('circle-color') ?? l.color ?? '#000',
      width: get('circle-radius') ?? l.width ?? 6,
    };
  }
  return l;
};

const getPatternStyles = (l) => {
  if (!l.pattern) return { backgroundColor: l.color };

  // Allow both object or flat fields
  const p = typeof l.pattern === 'object' ? l.pattern : {};
  const angle     = p.angle     ?? l.patternAngle     ?? 45; // deg
  const thickness = p.thickness ?? l.patternThickness ?? 3;  // px
  const gap       = p.gap       ?? l.patternGap       ?? 6;  // px
  const bg        = p.bg        ?? l.patternBg        ?? 'transparent'; // <- background color
  const t = Math.max(1, Number(thickness));
  const g = Math.max(1, Number(gap));

  return {
    // base fill under the stripes
    backgroundColor: bg,
    // stripes on top
    backgroundImage: `repeating-linear-gradient(${angle}deg, ${l.color} 0 ${t}px, transparent ${t}px ${t+g}px)`,
  };
};

const ALIGNMENTS = {
  left: 'w-full lg:w-1/3 m-left-chapter',
  fully: 'w-full lg:w-1/2 mx-auto',
  right: 'w-full lg:w-1/3 self-end m-right-chapter',
};

function Chapter({
  id,
  theme,
  type,
  stage,
  title,
  image,
  images,
  description,
  content,
  html,
  currentChapterId,
  legend,
  sources,
  alignment,
  setCurrentChapter,
  setCurrentAction,
  pinned,
  ...stageProps
}) {

const isStage = type === "stage" && stage;
const StageComponent = isStage ? STAGES[stage] : null;
 
  const { t } = useTranslation();



const stepClasses = cx(
  isStage ? "step w-full opacity-100" : "step max-w-md opacity-25",
  stageProps?.tight && "step--tight"
);

  const classList = id === currentChapterId ? `${stepClasses} active` : stepClasses;
  const renderImage = (img) => (
    <figure key={img.src} className="relative p-1">
      <img
        key={img.src}
        src={img.src}
        alt={title}
        className={cx('image w-full', { 'p-10': !img.title })}
      />
      {img.title && (
        <figcaption
          className={
            'absolute top-0 mt-1 p-1 flex uppercase tracking-wider bg-black bg-opacity-50 text-white text-xs'
          }
        >
          <div className="flex mr-1">{t(img.title)}</div>-
          <div className="font-bold ml-1">{t(img.author)}</div>
        </figcaption>
      )}
    </figure>
  );

 const renderLegend = (legend, sources) => (
  <div className="text-base leading-6">
    {(legend ?? []).map((raw) => {
      const l = resolveLegendItem(raw);
      return (
        <div key={l.title} className="flex items-center gap-4 mb-4">
          {l.icon ? (
            <LegendIcon icon={l.icon} />
          ) : l.symbol === 'line' ? (
            <svg width="28" height="16" aria-hidden="true" style={{ marginRight: 16 }} role="img" aria-label={t(l.title)}>
              <line
                x1="0" y1="8" x2="28" y2="8"
                stroke={l.color}
                strokeWidth={l.width ?? 3}
                strokeDasharray={Array.isArray(l.dasharray) ? l.dasharray.join(' ') : undefined}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : (
            <span
              className="legendItem w-8 h-8 mr-4"
              style={{
                ...getPatternStyles(l),
                border: l.border ? `solid 2px ${l.border}` : 'none',
              }}
            />
          )}
          <span>{t(l.title)}</span>
        </div>
      );
    })}
    {sources && <div className="ml-12">{t('Sources')}: {t(sources)}</div>}
  </div>
);

  const onEnter = () => {
    setCurrentChapter(id);
    setCurrentAction('enter');
  };
  const onLeave = () => {
    setCurrentChapter(id);
    setCurrentAction('leave');
  };

  const chapterRef = useRef(null);
  const chapterHeight = chapterRef.current?.offsetHeight;
  // Add some marging to the chapter if it's too small so it works correctly with the scrolling
  const extraHeight = chapterHeight && chapterHeight < 400 ? 'my-40' : '';

  return (
  <div id={id} className={cx(classList, isStage ? "w-full" : ALIGNMENTS[alignment])}>
      <Waypoint
        onEnter={onEnter}
        onLeave={onLeave}
        topOffset="-20%"
        bottomOffset="40%"
      />
      
      {isStage && StageComponent ? (
<div className={cx("stage-chapter w-full", theme)}>
<StageComponent
  chapter={{ id, title, description, content, html }}
  {...stageProps}
/>
  </div>
) : (
  <div
    ref={chapterRef}
    className={cx(
      theme,
      "rounded-lg p-6 space-y-4",
      pinned && "lg:sticky lg:top-[10vh] z-10",
      extraHeight
    )}
  >
    {/* existing normal chapter rendering stays exactly as-is */}
    {images && images.filter((i) => i.position === "top").map((i) => renderImage(i))}
    {title && (
      <div className="text-base leading-6">
        {title && <h3 className="font-lora text-2xl leading-8 pb-4">{t(title)}</h3>}
        {description && (
          <p
            className="text-base leading-6"
            dangerouslySetInnerHTML={{ __html: t(description) }}
          />
        )}
      </div>
    )}
    {legend && renderLegend(legend, sources)}
    {image && renderImage({ src: image })}
    {images && images.filter((i) => i.position === "bottom").map((i) => renderImage(i))}
  </div>
)}

    </div>
  );
}

export default Chapter;
