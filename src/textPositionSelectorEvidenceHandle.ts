import type { DocumentEnvelopeLimits } from './documentEnvelope.js';
import type { DocumentEnvelopeDigestProvider } from './documentEnvelopeRevision.js';
import type { CwlEditorTextPositionSelectorEvidence } from './textPositionSelectorEvidence.js';

/** Framework-neutral signature of the text-position evidence capture operation. */
export interface CwlEditorTextPositionSelectorEvidenceCapture {
  /**
   * Capture a W3C text-position selector and exact revision from one immutable
   * editor state. Returns `null` before the interactive editor exists.
   */
  (
    limits?: DocumentEnvelopeLimits,
    digestProvider?: DocumentEnvelopeDigestProvider | null,
  ): Promise<CwlEditorTextPositionSelectorEvidence | null>;
}

declare module './types.js' {
  interface CwlEditorHandle {
    /**
     * Capture privacy-minimized W3C text-position evidence for the current
     * selection and exact same document state.
     *
     * Positions count Unicode code points in the versioned Inkspan logical-text
     * projection, not ProseMirror structural positions, DOM offsets, Markdown
     * indexes, or durable cross-revision anchors. Selected text is not included.
     */
    getTextPositionSelectorEvidence: CwlEditorTextPositionSelectorEvidenceCapture;
  }
}
