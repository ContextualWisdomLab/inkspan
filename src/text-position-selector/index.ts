/**
 * React-free W3C text-position selector projection surface.
 *
 * This subpath exposes only deterministic projection primitives. Interactive
 * editor-handle capture and exact revision binding remain on the root Inkspan
 * editor contract.
 */
export {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  TextPositionSelectorEvidenceError,
  createTextPositionSelector,
} from '../textPositionSelectorEvidence.js';
export type {
  CwlEditorTextPositionSelector,
  CwlEditorTextProjectionIdentity,
  TextPositionSelectorEvidenceErrorCode,
} from '../textPositionSelectorEvidence.js';
