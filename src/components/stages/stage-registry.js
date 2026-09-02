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
import PinnedPanel from "../panel/pinned-panel";

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

  // Image panel pinned on the left, stepped text on the right. The panel holds
  // still while the image inside it and the paragraph beside it change
  // together. See src/components/panel/.
  PinnedPanel,
};
