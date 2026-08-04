import type {
  DocumentEnvelopeLimits,
} from './documentEnvelope.js';
import type {
  DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';
import type {
  CwlEditorDocumentRevisionEvidence,
} from './documentRevisionEvidence.js';

/**
 * Attach atomic revision-evidence capture to the interactive editor handle.
 *
 * Keeping this augmentation in an editor-only module prevents the dedicated
 * `/revision-evidence` declaration entrypoint from importing React, TipTap, or
 * the complete imperative editor contract.
 */
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

export {};
