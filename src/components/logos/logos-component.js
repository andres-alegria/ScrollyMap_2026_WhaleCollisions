import React from 'react';

const Logos = ({ logos }) => {
  // story-logos carries the small-screen override in app.scss; the Tailwind
  // classes still place it bottom-right on a wide screen.
  return logos && logos.length ? (
    <div className="story-logos fixed bottom-0 right-0 z-10 m-3 mb-6 flex items-center">
      {logos.map((logo, i) => (
        <a
          key={logo.name}
          title={logo.name}
          alt={logo.name}
          href={logo.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={logo.src}
            title={`${logo.name} logo`}
            alt={`${logo.name} logo`}
            className="ml-3"
            style={logo.width ? { width: `${logo.width}px` } : undefined}
          />
        </a>
      ))}
    </div>
  ) : null;
}

export default Logos;