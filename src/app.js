import React, { useState } from 'react';
import './app.scss';
import Story from './components/story/story';
import Globe from './components/globe/globe';
import Intro from './components/intro/intro';
import Logos from './components/logos/logos';
import ReadingProgress from './components/reading-progress/reading-progress';

const App = (props) => {
  const {
    chapters,
    theme,
    title,
    subtitle,
    byline,
    footer,
    intro,
    logos,
  } = props;
  const [currentChapterId, setCurrentChapter] = useState(chapters[0]);
  const [, setCurrentAction] = useState();

  return (
    <div>
      {/* Thin scroll progress bar pinned to the top of the viewport.
          ---- adjust progress bar color here ----
          Matches the whale track in the intro splash and the whale-track
          layer on the globe, so the bar reads as part of the same story. */}
      <ReadingProgress theme={theme} color="#BFECB1" />

      {intro && <Intro {...intro} />}
      <Logos logos={logos} />
      <Story
        hasIntro={!!intro}
        chapters={chapters}
        title={title}
        subtitle={subtitle}
        byline={byline}
        theme={theme}
        currentChapterId={currentChapterId}
        footer={footer}
        setCurrentChapter={setCurrentChapter}
        setCurrentAction={setCurrentAction}
      />
      <Globe chapters={chapters} />
    </div>
  );
};

export default App;
