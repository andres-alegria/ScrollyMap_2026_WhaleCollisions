import React from "react";
import "./PlainText.css";

export default function PlainTextStage({ chapter }) {
  const title = chapter?.title;
  const html = chapter?.html;
  const content = chapter?.content;

  return (
    <div className="stage-plain">
      <article className="plain-article">
        {title ? <h2 className="plain-title">{title}</h2> : null}

        {typeof html === "string" && html.trim().length ? (
          <div
            className="plain-html"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : Array.isArray(content) ? (
          content.map((p, i) => <p key={i}>{p}</p>)
        ) : typeof content === "string" ? (
          <p>{content}</p>
        ) : null}
      </article>
    </div>
  );
}
