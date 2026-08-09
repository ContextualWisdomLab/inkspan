import {
  DOCUMENT_ENVELOPE_SCHEMA_ID as INTERNAL_DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION as INTERNAL_DOCUMENT_ENVELOPE_SCHEMA_VERSION,
} from '../documentEnvelope.js';
import {
  createDocumentEnvelopeRevisionEvidence as createRevisionEvidenceInternal,
  createDocumentEnvelopeRevisionEvidenceBytes as createRevisionEvidenceBytesInternal,
} from '../documentRevisionEvidence.js';
import {
  DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID as INTERNAL_DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID,
  DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION as INTERNAL_DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION,
  createDocumentEnvelopeTransitionEvidence as createTransitionEvidenceInternal,
  createDocumentEnvelopeTransitionEvidenceBytes as createTransitionEvidenceBytesInternal,
} from '../documentTransitionEvidence.js';

/**
 * Framework-independent Inkspan revision-evidence entrypoint.
 *
 * This subpath intentionally excludes React, TipTap, ProseMirror, Yjs, editor
 * components, and transport or persistence adapters. Server, worker, queue,
 * migration, and storage processes can normalize versioned envelopes and derive
 * paired SHA-256 revision or compact transition evidence without loading the
 * interactive editor bundle. The root package retains equivalent exports for
 * compatibility.
 */

/** Canonical identifier for Inkspan's first portable document envelope. */
export const DOCUMENT_ENVELOPE_SCHEMA_ID:
  'https://inkspan.io/schemas/document-envelope/v1' =
    INTERNAL_DOCUMENT_ENVELOPE_SCHEMA_ID;

/** Current document-envelope schema version. */
export const DOCUMENT_ENVELOPE_SCHEMA_VERSION: 1 =
  INTERNAL_DOCUMENT_ENVELOPE_SCHEMA_VERSION;

/** Canonical identifier for Inkspan's first compact transition-evidence schema. */
export const DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID:
  'https://inkspan.io/schemas/document-transition-evidence/v1' =
    INTERNAL_DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID;

/** Current compact transition-evidence schema version. */
export const DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION: 1 =
  INTERNAL_DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION;

/** Optional resource ceilings applied while inspecting one envelope. */
export interface DocumentEnvelopeLimits {
  /** Maximum raw UTF-8 byte length before decoding. */
  readonly maxUtf8Bytes?: number;
  /** Maximum raw JSON-text length measured in JavaScript UTF-16 code units. */
  readonly maxJsonTextCodeUnits?: number;
  /** Maximum total number of scalar and container values in `documentJson`. */
  readonly maxJsonValues?: number;
  /** Maximum length of any decoded string value or object name. */
  readonly maxStringCodeUnits?: number;
  /** Maximum nested object/array depth below the document root. */
  readonly maxNestingDepth?: number;
}

/** JSON scalar accepted by the portable document-envelope boundary. */
export type CwlEditorDocumentJsonScalar =
  | string
  | number
  | boolean
  | null;

/** Recursively immutable JSON value accepted by an Inkspan document envelope. */
export type CwlEditorDocumentJsonValue =
  | CwlEditorDocumentJsonScalar
  | readonly CwlEditorDocumentJsonValue[]
  | { readonly [fieldName: string]: CwlEditorDocumentJsonValue };

/**
 * Framework-neutral structural document JSON.
 *
 * Inkspan validates that the root contains `type: 'doc'` at runtime. The broad
 * JSON object contract deliberately avoids importing TipTap declarations into
 * server and worker consumers while preserving the complete stored structure.
 */
export type CwlEditorDocumentJson = Readonly<{
  readonly [fieldName: string]: CwlEditorDocumentJsonValue;
}>;

/** Portable, versioned wrapper for lossless structural document JSON. */
export interface CwlEditorDocumentEnvelope {
  /** Stable schema identifier used for routing and migration. */
  readonly schemaId: typeof DOCUMENT_ENVELOPE_SCHEMA_ID;
  /** Integer schema version used for compatibility checks. */
  readonly schemaVersion: typeof DOCUMENT_ENVELOPE_SCHEMA_VERSION;
  /** Detached, deeply frozen structural document JSON. */
  readonly documentJson: CwlEditorDocumentJson;
}

/** Exact canonical byte view supplied to an injected digest provider. */
export type DocumentEnvelopeDigestSource = Uint8Array;

/** SHA-256 provider compatible with Web Crypto and Node.js crypto adapters. */
export interface DocumentEnvelopeDigestProvider {
  /** Produce a SHA-256 digest for one complete canonical byte sequence. */
  digest(
    algorithm: 'SHA-256',
    source: DocumentEnvelopeDigestSource,
  ): Promise<ArrayBuffer>;
}

/** Portable strong validator derived from one canonical document envelope. */
export interface CwlEditorDocumentRevision {
  /** Cryptographic digest algorithm used for the revision validator. */
  readonly algorithm: 'SHA-256';
  /** Lowercase 64-character hexadecimal SHA-256 digest. */
  readonly digestHex: string;
  /** Quoted strong HTTP entity tag suitable for an exact canonical payload. */
  readonly strongEntityTag: string;
}

/** Detached atomic evidence for one normalized document revision. */
export interface CwlEditorDocumentRevisionEvidence {
  /** Exact frozen envelope whose canonical bytes were hashed. */
  readonly envelope: CwlEditorDocumentEnvelope;
  /** SHA-256 strong validator derived from that exact `envelope`. */
  readonly revision: CwlEditorDocumentRevision;
}

/**
 * Privacy-minimized local lineage between two validated document revisions.
 *
 * This result binds content revisions only. It does not prove actor identity,
 * tenant authority, time, operation type, signature, durable persistence,
 * transport success, review acceptance, or model execution.
 */
export interface CwlEditorDocumentTransitionEvidence {
  /** Stable identifier for the transition-evidence field contract. */
  readonly schemaId: typeof DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID;
  /** Integer schema version used for compatibility routing. */
  readonly schemaVersion: typeof DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION;
  /** SHA-256 revision derived from the validated previous envelope. */
  readonly previousRevision: CwlEditorDocumentRevision;
  /** SHA-256 revision derived from the validated resulting envelope. */
  readonly resultingRevision: CwlEditorDocumentRevision;
  /** Whether the two canonical envelope revisions differ. */
  readonly changed: boolean;
}

/**
 * Create frozen revision evidence from an envelope object or JSON text.
 *
 * The source is parsed once through Inkspan's strict versioned-envelope
 * boundary. The returned envelope is the exact normalized frozen payload whose
 * RFC 8785 canonical UTF-8 bytes produced the paired SHA-256 revision.
 */
export function createDocumentEnvelopeRevisionEvidence(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence> {
  return createRevisionEvidenceInternal(
    source,
    limits,
    digestProvider as unknown as Parameters<
      typeof createRevisionEvidenceInternal
    >[2],
  ) as unknown as Promise<CwlEditorDocumentRevisionEvidence>;
}

/**
 * Create frozen revision evidence from strict UTF-8 envelope bytes.
 *
 * Noncanonical but valid JSON is normalized before hashing. Malformed UTF-8,
 * byte-order marks, duplicate object names, unsupported versions, and resource-
 * limit violations fail before the digest provider runs.
 */
export function createDocumentEnvelopeRevisionEvidenceBytes(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence> {
  return createRevisionEvidenceBytesInternal(
    source,
    limits,
    digestProvider as unknown as Parameters<
      typeof createRevisionEvidenceBytesInternal
    >[2],
  ) as unknown as Promise<CwlEditorDocumentRevisionEvidence>;
}

/**
 * Derive compact transition evidence from two envelope objects or JSON texts.
 *
 * Both sources are validated before hashing. Successful calls hash previous
 * content first and resulting content second, then return only the frozen
 * revision pair and deterministic changed classification.
 */
export function createDocumentEnvelopeTransitionEvidence(
  previousSource: unknown,
  resultingSource: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentTransitionEvidence> {
  return createTransitionEvidenceInternal(
    previousSource,
    resultingSource,
    limits,
    digestProvider as unknown as Parameters<
      typeof createTransitionEvidenceInternal
    >[3],
  ) as unknown as Promise<CwlEditorDocumentTransitionEvidence>;
}

/**
 * Derive compact transition evidence from two strict UTF-8 envelope byte views.
 *
 * Equivalent noncanonical JSON encodings normalize to the same revision pair.
 * Invalid bytes, duplicate names, unsupported versions, and resource-limit
 * violations fail before the digest provider runs.
 */
export function createDocumentEnvelopeTransitionEvidenceBytes(
  previousSource: unknown,
  resultingSource: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentTransitionEvidence> {
  return createTransitionEvidenceBytesInternal(
    previousSource,
    resultingSource,
    limits,
    digestProvider as unknown as Parameters<
      typeof createTransitionEvidenceBytesInternal
    >[3],
  ) as unknown as Promise<CwlEditorDocumentTransitionEvidence>;
}
