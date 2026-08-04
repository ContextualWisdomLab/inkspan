import type {
  CwlEditorDocumentEnvelope,
  DocumentEnvelopeLimits,
} from './documentEnvelope.js';
import type {
  CwlEditorDocumentRevision,
  DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';

/**
 * Detached atomic evidence for one captured editor document revision.
 *
 * The envelope and revision are derived from the same frozen capture. Hosts can
 * retain the pair as the base of delayed autosave, AI, template, review, audit,
 * compare, merge, fork, or retry workflows without racing a second editor read.
 */
export interface CwlEditorDocumentRevisionEvidence {
  /** Exact frozen versioned envelope captured before asynchronous hashing. */
  readonly envelope: CwlEditorDocumentEnvelope;
  /** SHA-256 strong validator derived from that exact `envelope`. */
  readonly revision: CwlEditorDocumentRevision;
}

declare module './types.js' {
  interface CwlEditorHandle {
    /**
     * Capture one frozen envelope and its matching SHA-256 strong revision.
     *
     * Returns `null` before editor creation. A provider can be injected when the
     * host runtime does not expose Web Cryptography. Later editor changes do not
     * alter or invalidate the returned evidence pair; durable writes must still
     * enforce authenticated atomic RFC 9110 `If-Match` in host-owned storage.
     */
    getDocumentEnvelopeRevisionEvidence(
      limits?: DocumentEnvelopeLimits,
      digestProvider?: DocumentEnvelopeDigestProvider | null,
    ): Promise<CwlEditorDocumentRevisionEvidence | null>;
  }
}
