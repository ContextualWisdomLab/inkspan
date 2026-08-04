import {
  DEFAULT_DOCUMENT_ENVELOPE_LIMITS as runtimeDefaultDocumentEnvelopeLimits,
  DOCUMENT_ENVELOPE_SCHEMA_ID as runtimeDocumentEnvelopeSchemaId,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION as runtimeDocumentEnvelopeSchemaVersion,
  DocumentEnvelopeError as RuntimeDocumentEnvelopeError,
} from '../documentEnvelope.js';
import { DocumentEnvelopeRevisionError as RuntimeDocumentEnvelopeRevisionError } from '../documentEnvelopeRevision.js';
import {
  createDocumentEnvelopeRevisionEvidence as createRuntimeDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes as createRuntimeDocumentEnvelopeRevisionEvidenceBytes,
} from '../documentRevisionEvidence.js';

/** JSON primitive accepted by Inkspan's provider-neutral persistence boundary. */
export type CwlEditorJsonPrimitive = null | boolean | number | string;

/**
 * Read-only JSON object used by the standalone revision-evidence declarations.
 *
 * Property names and values remain ordinary JSON data. Accessors, symbols,
 * cycles, sparse arrays, unsupported numbers, and other JavaScript-only values
 * are rejected by the runtime parser before an evidence object is returned.
 */
export interface CwlEditorJsonObject {
  readonly [propertyName: string]: CwlEditorJsonValue;
}

/** Recursive, deeply read-only JSON value retained in a validated envelope. */
export type CwlEditorJsonValue =
  | CwlEditorJsonPrimitive
  | readonly CwlEditorJsonValue[]
  | CwlEditorJsonObject;

/**
 * Provider-neutral TipTap/ProseMirror document JSON after strict validation.
 *
 * Inkspan requires the root node to be `doc`. Nested node and mark fields remain
 * schema-defined JSON so hosts can persist, compare, migrate, and audit the
 * structure without importing React or TipTap declarations.
 */
export interface CwlEditorDocumentJson extends CwlEditorJsonObject {
  readonly type: 'doc';
}

/** Optional resource ceilings applied while inspecting an envelope. */
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

/** Portable, versioned wrapper for validated rich-text document JSON. */
export interface CwlEditorDocumentEnvelope {
  /** Stable schema identifier used for routing and migration. */
  readonly schemaId: 'https://inkspan.io/schemas/document-envelope/v1';
  /** Integer schema version used for compatibility checks. */
  readonly schemaVersion: 1;
  /** Detached, deeply frozen provider-neutral document JSON. */
  readonly documentJson: CwlEditorDocumentJson;
}

/** Byte source accepted by a provider-neutral SHA-256 digest implementation. */
export type DocumentEnvelopeDigestSource = ArrayBuffer | ArrayBufferView;

/** SHA-256 provider compatible with Web Cryptography digest semantics. */
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

/**
 * One immutable normalized envelope paired with the revision derived from it.
 */
export interface CwlEditorDocumentRevisionEvidence {
  /** Exact deeply frozen envelope whose canonical bytes were hashed. */
  readonly envelope: CwlEditorDocumentEnvelope;
  /** Frozen SHA-256 revision derived from `envelope`. */
  readonly revision: CwlEditorDocumentRevision;
}

/** Standalone constructor contract for a redacted envelope-validation error. */
interface DocumentEnvelopeErrorConstructor {
  new (message: string): DocumentEnvelopeError;
  readonly prototype: DocumentEnvelopeError;
}

/** Error raised when an envelope is malformed, unsafe, or incompatible. */
export interface DocumentEnvelopeError extends TypeError {
  /** Stable public error name suitable for bounded error classification. */
  readonly name: 'DocumentEnvelopeError';
}

/**
 * Runtime envelope error class shared with the root editor entrypoint.
 *
 * The explicit local constructor contract keeps this subpath's declarations
 * independent while preserving exact `instanceof` identity across entrypoints.
 */
export const DocumentEnvelopeError: DocumentEnvelopeErrorConstructor =
  RuntimeDocumentEnvelopeError as unknown as DocumentEnvelopeErrorConstructor;

/** Standalone constructor contract for a redacted revision-generation error. */
interface DocumentEnvelopeRevisionErrorConstructor {
  new (message: string): DocumentEnvelopeRevisionError;
  readonly prototype: DocumentEnvelopeRevisionError;
}

/** Error raised when a SHA-256 revision cannot be produced safely. */
export interface DocumentEnvelopeRevisionError extends Error {
  /** Stable public error name suitable for bounded error classification. */
  readonly name: 'DocumentEnvelopeRevisionError';
}

/**
 * Runtime revision error class shared with the root editor entrypoint.
 *
 * Consumers can catch the class without importing the React editor surface.
 */
export const DocumentEnvelopeRevisionError: DocumentEnvelopeRevisionErrorConstructor =
  RuntimeDocumentEnvelopeRevisionError as unknown as DocumentEnvelopeRevisionErrorConstructor;

/** Canonical identifier for Inkspan's first portable document envelope. */
export const DOCUMENT_ENVELOPE_SCHEMA_ID:
  'https://inkspan.io/schemas/document-envelope/v1' =
  runtimeDocumentEnvelopeSchemaId;

/** Current supported document-envelope schema version. */
export const DOCUMENT_ENVELOPE_SCHEMA_VERSION: 1 =
  runtimeDocumentEnvelopeSchemaVersion;

/**
 * Frozen fail-closed defaults for large commercial document envelopes.
 */
export const DEFAULT_DOCUMENT_ENVELOPE_LIMITS: Readonly<
  Required<DocumentEnvelopeLimits>
> = runtimeDefaultDocumentEnvelopeLimits;

/**
 * Parse one object or JSON-text envelope and return matching revision evidence.
 *
 * The source is validated and normalized once. The returned envelope is the
 * exact frozen value whose RFC 8785 canonical UTF-8 bytes are passed to the
 * SHA-256 provider. Omitting `digestProvider` uses platform Web Cryptography;
 * passing `null` fails closed instead of selecting a weaker algorithm.
 */
export function createDocumentEnvelopeRevisionEvidence(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence> {
  return createRuntimeDocumentEnvelopeRevisionEvidence(
    source,
    limits,
    digestProvider,
  ) as unknown as Promise<CwlEditorDocumentRevisionEvidence>;
}

/**
 * Parse strict UTF-8 envelope bytes and return matching revision evidence.
 *
 * The byte sequence is copied before decoding, rejects a byte-order mark and
 * malformed UTF-8, normalizes valid noncanonical JSON, and invokes the digest
 * provider exactly once for the canonical bytes of the returned envelope.
 */
export function createDocumentEnvelopeRevisionEvidenceBytes(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence> {
  return createRuntimeDocumentEnvelopeRevisionEvidenceBytes(
    source,
    limits,
    digestProvider,
  ) as unknown as Promise<CwlEditorDocumentRevisionEvidence>;
}
