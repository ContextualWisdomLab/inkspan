import {
  DOCUMENT_ENVELOPE_SCHEMA_ID as INTERNAL_DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION as INTERNAL_DOCUMENT_ENVELOPE_SCHEMA_VERSION,
} from '../documentEnvelope.js';
import {
  createDocumentEnvelopeRevisionEvidence as createRevisionEvidenceInternal,
  createDocumentEnvelopeRevisionEvidenceBytes as createRevisionEvidenceBytesInternal,
} from '../documentRevisionEvidence.js';

/**
 * Framework-independent Inkspan revision-evidence entrypoint.
 *
 * This subpath intentionally excludes React, TipTap, ProseMirror, Yjs, editor
 * components, and transport or persistence adapters. Server, worker, queue,
 * migration, and storage processes can normalize versioned envelopes and derive
 * paired SHA-256 revision evidence without loading the interactive editor
 * bundle. The root package retains equivalent exports for compatibility.
 */

/** Canonical identifier for Inkspan's first portable document envelope. */
export const DOCUMENT_ENVELOPE_SCHEMA_ID:
  'https://inkspan.io/schemas/document-envelope/v1' =
    INTERNAL_DOCUMENT_ENVELOPE_SCHEMA_ID;

/** Current document-envelope schema version. */
export const DOCUMENT_ENVELOPE_SCHEMA_VERSION: 1 =
  INTERNAL_DOCUMENT_ENVELOPE_SCHEMA_VERSION;

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

/** Portable byte source accepted by the injected digest-provider boundary. */
export type DocumentEnvelopeDigestSource = ArrayBuffer | ArrayBufferView;

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
    digestProvider,
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
    digestProvider,
  ) as unknown as Promise<CwlEditorDocumentRevisionEvidence>;
}
