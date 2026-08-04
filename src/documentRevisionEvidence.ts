import {
  parseDocumentEnvelope,
  parseDocumentEnvelopeBytes,
  type CwlEditorDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from './documentEnvelope.js';
import {
  createValidatedDocumentEnvelopeRevision,
  type CwlEditorDocumentRevision,
  type DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';

/**
 * Detached atomic evidence for one captured editor document revision.
 *
 * The envelope and revision are derived from the same frozen capture. Hosts can
 * retain the pair as the base of delayed autosave, AI, template, review, audit,
 * compare, merge, fork, or retry workflows without racing a second document
 * parse or editor read.
 */
export interface CwlEditorDocumentRevisionEvidence {
  /** Exact frozen versioned envelope captured before asynchronous hashing. */
  readonly envelope: CwlEditorDocumentEnvelope;
  /** SHA-256 strong validator derived from that exact `envelope`. */
  readonly revision: CwlEditorDocumentRevision;
}

/**
 * Create frozen revision evidence from an envelope object or JSON text.
 *
 * The source is parsed once through Inkspan's strict versioned-envelope
 * boundary. The returned envelope is the exact normalized frozen payload whose
 * RFC 8785 canonical UTF-8 bytes produced the paired SHA-256 revision.
 */
export async function createDocumentEnvelopeRevisionEvidence(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence> {
  const envelope = parseDocumentEnvelope(source, limits);
  return createValidatedDocumentEnvelopeRevisionEvidence(
    envelope,
    digestProvider,
  );
}

/**
 * Create frozen revision evidence from strict UTF-8 envelope bytes.
 *
 * Noncanonical but valid JSON is normalized through the existing strict byte
 * parser before hashing. Malformed UTF-8, byte-order marks, duplicate names,
 * unsupported versions, and resource-limit violations fail before the digest
 * provider runs.
 */
export async function createDocumentEnvelopeRevisionEvidenceBytes(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence> {
  const envelope = parseDocumentEnvelopeBytes(source, limits);
  return createValidatedDocumentEnvelopeRevisionEvidence(
    envelope,
    digestProvider,
  );
}

/**
 * Pair an already validated frozen envelope with its canonical SHA-256 revision.
 *
 * This package-internal integration helper lets imperative editor capture and
 * pure persistence consumers share one pairing implementation without a second
 * parse, editor read, document clone, canonicalization pass, or digest call.
 */
export async function createValidatedDocumentEnvelopeRevisionEvidence(
  envelope: CwlEditorDocumentEnvelope,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence> {
  const revision = await createValidatedDocumentEnvelopeRevision(
    envelope,
    digestProvider,
  );
  return Object.freeze({ envelope, revision });
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
