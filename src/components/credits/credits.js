import React from 'react';
import { useTranslation } from 'react-i18next';
import './credits.scss';

/**
 * Closing block: who made it, on individual lines, and where the data came
 * from, as continuous prose. Sits on the same dark ground as the footer.
 *
 * Ported from the isolated-peoples scrolly. Content lives in config.js under
 * `credits`.
 */
const Credits = ({ credits }) => {
  const { t } = useTranslation();
  if (!credits) return null;
  const { title, backToStart, people = [], sourcesTitle, sources } = credits;

  return (
    <section className="credits" id="credits">
      {backToStart && (
        <div className="credits__back-wrap">
          <button
            type="button"
            className="credits__back"
            // Jumping rather than smooth-scrolling: this is tens of thousands
            // of pixels, and every scrubbed animation in the piece would be
            // whipped through on the way past.
            onClick={() => window.scrollTo({ top: 0, behavior: 'auto' })}
          >
            {t(backToStart)}
          </button>
        </div>
      )}

      <div className="credits__inner">
        {title && <h2 className="credits__title">{t(title)}</h2>}

        {people.length > 0 && (
          <dl className="credits__list">
            {people.map((p) => (
              <div className="credits__row" key={`${p.role}-${p.name}`}>
                <dt className="credits__role">{t(p.role)}</dt>
                <dd className="credits__name">{t(p.name)}</dd>
              </div>
            ))}
          </dl>
        )}

        {sources && (
          <React.Fragment>
            {sourcesTitle && <h3 className="credits__subtitle">{t(sourcesTitle)}</h3>}
            <p className="credits__sources"
               dangerouslySetInnerHTML={{ __html: t(sources) }} />
          </React.Fragment>
        )}
      </div>
    </section>
  );
};

export default Credits;
