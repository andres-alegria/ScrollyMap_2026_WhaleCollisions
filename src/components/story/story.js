import React from 'react';
import cx from 'classnames';
import Chapter from '../chapter/chapter';
import Credits from '../credits/credits';
import { useTranslation } from 'react-i18next';
import './story.scss';

const Story = ({ title, subtitle, byline, theme, chapters, alignment, currentChapterId, footer, credits, hasIntro, setCurrentChapter, setCurrentAction }) => {
  const { t } = useTranslation();

  return (
    <div id="story" className={cx({ "withIntro": hasIntro })}>
      {title && (
        <div id="header" className={theme}>
          <h1>{t(title)}</h1>
          {subtitle && <h2>{t(subtitle)}</h2>}
          {byline && <p>{t(byline)}</p>}
        </div>
      )}
      <div id="features" className="w-[90%] mx-auto flex flex-col">
        {chapters.map((chapter) => (
          <Chapter
            key={chapter.id}
            theme={theme}
            {...chapter}
            currentChapterId={currentChapterId}
            setCurrentChapter={setCurrentChapter}
            setCurrentAction={setCurrentAction}
          />
        ))}
      </div>
      {/* Credits close the story, then the footer strip beneath them. The
          footer renders whether or not it has text: it is the dark band the
          fixed logo sits on, and the sources it used to carry are now in the
          credits section above. */}
      <Credits credits={credits} />
      <div id="footer" className={`footer-${theme} p-4 pb-16 w-full text-right text-base`}>
        {footer && <p>{t(footer)}</p>}
      </div>
    </div>
  );
}

export default Story;