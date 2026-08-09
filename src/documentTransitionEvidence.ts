import {
  parseDocumentEnvelope,
  parseDocumentEnvelopeBytes,
  type CwlEditorDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from './documentEnvelope.js';
import type {
  CwlEditorDocumentRevision,
  DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';
import { createValidatedDocumentEnvelopeRevisionEvidence } from './documentRevisionEvidence.js';

/** Canonical identifier for Inkspan's first compact transition-evidence schema. */
export const DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID =
  'https://inkspan.io/schemas/document-transition-evidence/v1' as const;

/** Current compact transition-evidence schema version. */
export const DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION = 1 as const;

/**
 * Privacy-minimized local lineage between two validated document revisions.
 *
 * This value binds content revisions only. It does not prove actor identity,
 * tenant authority, time, operation type, signature, durable persistence,
 * transport success, review acceptance, or model execution.
 */
export interface CwlEditorDocumentTransitionEvidence {
  /** Stable identifier for the transition-evidence field contract. */
  readonly schemaId: typeof DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID;
  /** Integer schema version for compatibility routing. */
  readonly schemaVersion: typeof DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION;
  /** SHA-256 revision derived from the validated previous envelope. */
  readonly previousRevision: CwlEditorDocumentRevision;
  /** SHA-256 revision derived from the validated resulting envelope. */
  readonly resultingRevision: CwlEditorDocumentRevision;
  /** Whether the two canonical envelope revisions differ. */
  readonly changed: boolean;
}

type DocumentEnvelopeParser = (
  source: unknown,
  limits?: DocumentEnvelopeLimits,
) => CwlEditorDocumentEnvelope;

/**
 * Derive compact transition evidence from two envelope objects or JSON texts.
 *
 * Both inputs pass the strict versioned-envelope boundary before either digest
 * begins. Successful operations hash the previous canonical envelope first and
 * the resulting canonical envelope second, then return frozen revision-only
 * evidence without retaining either complete document in the result.
 */
export function createDocumentEnvelopeTransitionEvidence(
  previousSource: unknown,
  resultingSource: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentTransitionEvidence> {
  return createTransitionEvidence(
    previousSource,
    resultingSource,
    limits,
    digestProvider,
    parseDocumentEnvelope,
  );
}

/**
 * Derive compact transition evidence from two strict UTF-8 envelope byte views.
 *
 * Malformed UTF-8, byte-order marks, duplicate object names, unsupported
 * versions, and resource-limit violations fail before hashing. Equivalent
 * noncanonical JSON encodings normalize to the same revision pair.
 */
export function createDocumentEnvelopeTransitionEvidenceBytes(
  previousSource: unknown,
  resultingSource: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentTransitionEvidence> {
  return createTransitionEvidence(
    previousSource,
    resultingSource,
    limits,
    digestProvider,
    parseDocumentEnvelopeBytes,
  );
}

/** Parse both documents, hash them sequentially, and expose revisions only. */
async function createTransitionEvidence(
  previousSource: unknown,
  resultingSource: unknown,
  limits: DocumentEnvelopeLimits | undefined,
  digestProvider: DocumentEnvelopeDigestProvider | null | undefined,
  parse: DocumentEnvelopeParser,
): Promise<CwlEditorDocumentTransitionEvidence> {
  const previousEnvelope = parse(previousSource, limits);
  const resultingEnvelope = parse(resultingSource, limits);

  const previousEvidence =
    await createValidatedDocumentEnvelopeRevisionEvidence(
      previousEnvelope,
      digestProvider,
    );
  const resultingEvidence =
    await createValidatedDocumentEnvelopeRevisionEvidence(
      resultingEnvelope,
      digestProvider,
    );

  return Object.freeze({
    schemaId: DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID,
    schemaVersion: DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION,
    previousRevision: previousEvidence.revision,
    resultingRevision: resultingEvidence.revision,
    changed:
      previousEvidence.revision.digestHex !==
      resultingEvidence.revision.digestHex,
  });
}
