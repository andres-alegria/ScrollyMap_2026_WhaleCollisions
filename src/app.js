import React, { useState } from 'react';
import './app.scss';
import Story from './components/story/story';
import Intro from './components/intro/intro';
import Logos from './components/logos/logos';
import ReadingProgress from './components/reading-progress/reading-progress';

const App = (props) => {
  const {
    chapters,
    accessToken,
    style,
    theme,
    title,
    subtitle,
    byline,
    footer,
    intro,
    logos,
    credits,
  } = props;
  const [currentChapterId, setCurrentChapter] = useState(chapters[0] && chapters[0].id);
  const [, setCurrentAction] = useState();

  // The map lives inside the story's panel rather than behind the whole page,
  // but a missing token or style still leaves that panel empty, so say which
  // one is absent rather than rendering a blank frame.
  const renderError = (missing) => (
    <div className="flex justify-center items-center h-screen">
      Please add the missing {missing}. See the README.
    </div>
  );
  if (!style || style === 'ADD YOUR MAPBOX STYLE HERE') return renderError('Mapbox map style');
  if (!accessToken) return renderError('Mapbox access token');

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
        credits={credits}
        setCurrentChapter={setCurrentChapter}
        setCurrentAction={setCurrentAction}
      />
    </div>
  );
};

export default App;
