import {
  parseDocumentEnvelope,
  parseDocumentEnvelopeBytes,
  type CwlEditorDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from './documentEnvelope.js';
import {
  createValidatedDocumentEnvelopeRevisionWithResolvedProvider,
  resolveDocumentEnvelopeDigestProvider,
  type CwlEditorDocumentRevision,
  type DocumentEnvelopeDigestProvider,
  type ResolvedDocumentEnvelopeDigestProvider,
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
 * The digest capability is captured before caller-controlled source processing.
 * The source is then parsed once through Inkspan's strict versioned-envelope
 * boundary. The returned envelope is the exact normalized frozen payload whose
 * RFC 8785 canonical UTF-8 bytes produced the paired SHA-256 revision.
 */
export async function createDocumentEnvelopeRevisionEvidence(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence> {
  const resolvedProvider = resolveDocumentEnvelopeDigestProvider(digestProvider);
  const envelope = parseDocumentEnvelope(source, limits);
  return createValidatedDocumentEnvelopeRevisionEvidenceWithResolvedProvider(
    envelope,
    resolvedProvider,
  );
}

/**
 * Create frozen revision evidence from strict UTF-8 envelope bytes.
 *
 * The digest capability is captured before byte-source processing. Noncanonical
 * but valid JSON is normalized through the existing strict byte parser before
 * hashing. Malformed UTF-8, byte-order marks, duplicate names, unsupported
 * versions, and resource-limit violations fail before the digest callable runs.
 */
export async function createDocumentEnvelopeRevisionEvidenceBytes(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence> {
  const resolvedProvider = resolveDocumentEnvelopeDigestProvider(digestProvider);
  const envelope = parseDocumentEnvelopeBytes(source, limits);
  return createValidatedDocumentEnvelopeRevisionEvidenceWithResolvedProvider(
    envelope,
    resolvedProvider,
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
  return createValidatedDocumentEnvelopeRevisionEvidenceWithResolvedProvider(
    envelope,
    resolveDocumentEnvelopeDigestProvider(digestProvider),
  );
}

/** Pair a validated envelope with a revision using one captured digest capability. */
async function createValidatedDocumentEnvelopeRevisionEvidenceWithResolvedProvider(
  envelope: CwlEditorDocumentEnvelope,
  resolvedProvider: ResolvedDocumentEnvelopeDigestProvider,
): Promise<CwlEditorDocumentRevisionEvidence> {
  const revision =
    await createValidatedDocumentEnvelopeRevisionWithResolvedProvider(
      envelope,
      resolvedProvider,
    );
  return Object.freeze({ envelope, revision });
}
