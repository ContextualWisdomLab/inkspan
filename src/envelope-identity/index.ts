import {
  inspectDocumentEnvelopeIdentity as inspectIdentityInternal,
  inspectDocumentEnvelopeIdentityBytes as inspectIdentityBytesInternal,
} from '../documentEnvelopeIdentity.js';

/**
 * Framework-independent document-envelope identity routing entrypoint.
 *
 * This subpath intentionally excludes React, TipTap UI, ProseMirror view, Yjs,
 * network clients, persistence adapters, credentials, and model SDKs. It returns
 * only validated schema identity so a host can select its own migration path.
 */

/** Optional resource ceilings shared with Inkspan's strict envelope boundary. */
export interface DocumentEnvelopeLimits {
  /** Maximum raw UTF-8 byte length before decoding. */
  readonly maxUtf8Bytes?: number;
  /** Maximum raw JSON-text length measured in JavaScript UTF-16 code units. */
  readonly maxJsonTextCodeUnits?: number;
  /** Maximum total scalar and container values inside `documentJson`. */
  readonly maxJsonValues?: number;
  /** Maximum decoded string value or object-name length. */
  readonly maxStringCodeUnits?: number;
  /** Maximum nested object/array depth below `documentJson`. */
  readonly maxNestingDepth?: number;
}

/** Frozen schema identity used only for host-owned migration routing. */
export interface CwlEditorDocumentEnvelopeIdentity {
  /** Schema identifier supplied by the complete envelope. */
  readonly schemaId: string;
  /** Positive safe-integer schema version supplied by the complete envelope. */
  readonly schemaVersion: number;
}

/** Inspect an envelope object or complete JSON text without validating current document semantics. */
export function inspectDocumentEnvelopeIdentity(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): Readonly<CwlEditorDocumentEnvelopeIdentity> {
  return inspectIdentityInternal(
    source,
    limits as Parameters<typeof inspectIdentityInternal>[1],
  ) as Readonly<CwlEditorDocumentEnvelopeIdentity>;
}

/** Inspect strict UTF-8 envelope bytes without validating current document semantics. */
export function inspectDocumentEnvelopeIdentityBytes(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): Readonly<CwlEditorDocumentEnvelopeIdentity> {
  return inspectIdentityBytesInternal(
    source,
    limits as Parameters<typeof inspectIdentityBytesInternal>[1],
  ) as Readonly<CwlEditorDocumentEnvelopeIdentity>;
}
