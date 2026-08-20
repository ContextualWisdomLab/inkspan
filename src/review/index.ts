/**
 * React-free review contract surface.
 *
 * Inkspan owns deterministic review targets bound to an exact canonical
 * document revision and text projection. Hosts own durable review records,
 * identity, authorization, tenancy, persistence, retention, notifications,
 * audit, and cross-revision re-anchoring policy.
 */

import type { CwlEditorDocumentRevision } from '../documentEnvelopeRevision.js';
import type {
  CwlEditorTextPositionSelector,
  CwlEditorTextProjectionIdentity,
} from '../textPositionSelectorEvidence.js';

/** Version of Inkspan's deterministic review-target contract. */
export const INKSPAN_REVIEW_CONTRACT_VERSION = 1 as const;

/**
 * Immutable target for a host-owned comment or suggestion.
 *
 * Positions are W3C TextPositionSelector offsets in Inkspan's canonical text
 * projection, never DOM offsets. The revision validator prevents a host from
 * silently applying a target to a different document revision.
 */
export interface CwlReviewTarget {
  readonly contractVersion: typeof INKSPAN_REVIEW_CONTRACT_VERSION;
  readonly revision: CwlEditorDocumentRevision;
  readonly selector: CwlEditorTextPositionSelector;
  readonly projection: CwlEditorTextProjectionIdentity;
}

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
export {
  DocumentEnvelopeRevisionError,
  createDocumentEnvelopeRevision,
  createDocumentEnvelopeRevisionBytes,
} from '../documentEnvelopeRevision.js';
export type {
  CwlEditorDocumentRevision,
  DocumentEnvelopeDigestProvider,
} from '../documentEnvelopeRevision.js';
