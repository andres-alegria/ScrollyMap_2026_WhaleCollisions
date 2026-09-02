// Stage registry
//
// Add / remove stage "types" here.
// Each key in STAGES is a stage "type" you can reference from config.js.
// Example (in config.js):
//   { type: "PlainImage", ... }
//
// NOTE: "ComboHorizFilterStage" was removed on purpose (legacy / unused).

import GalleryHorizontalScroll from "./GalleryHorizontalScroll";
import GalleryFilter from "./GalleryFilter";
import GalleryFlipImage from "./GalleryFlipImage";
import PlainText from "./PlainText";
import PlainImage from "./PlainImage";

export const STAGES = {
  // Horizontal image-strip scroller
  GalleryHorizontalScroll,

  // Gallery + filter UI stage
  GalleryFilter,

  // Horizontal gallery with flip-on-hover cards (mousewheel scroll)
  GalleryFlipImage,

  // Simple text block stage (no map interaction)
  PlainText,

  // Full-width (or constrained) image stage
  PlainImage,
};
