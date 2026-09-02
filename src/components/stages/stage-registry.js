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
import MapIntro from "../panel/map-intro";
import MapPanel from "../panel/map-panel";

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

  // Full-screen map that closes from the world onto the subject as the
  // section is entered, then raises a short full-width card over it.
  MapIntro,

  // One pinned box holding a live map, with stepped text beside it. The box
  // stays put and the camera moves inside it; the paragraph changes to match.
  // See src/components/panel/.
  MapPanel,
};
