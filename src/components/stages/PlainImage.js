import React from "react";
import "./PlainImage.css";

export default function PlainImage(props) {
  const { src, alt = "", height = "100vh", fit = "cover", position = "center" } = props || {};
  if (!src) return null;

  return (
    <section className="panel plain-image" style={{ height }}>
      <img
        className="plain-image__img"
        src={src}
        alt={alt}
        style={{ objectFit: fit, objectPosition: position }}
      />
    </section>
  );
}
