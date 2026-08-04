import {
  parseDocumentEnvelope,
  parseDocumentEnvelopeBytes,
  type CwlEditorDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from './documentEnvelope.js';
import { encodeValidatedDocumentEnvelope } from './documentEnvelopeCanonical.js';

const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  'byteLength',
)!.get!;

/** SHA-256 provider compatible with the Web Cryptography `SubtleCrypto` API. */
export interface DocumentEnvelopeDigestProvider {
  /** Produce a SHA-256 digest for one complete canonical byte sequence. */
  digest(algorithm: 'SHA-256', source: BufferSource): Promise<ArrayBuffer>;
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

/** Exact frozen document payload paired with its strong revision validator. */
export interface CwlEditorDocumentRevisionEvidence {
  /** Deeply frozen envelope whose canonical bytes were hashed. */
  readonly envelope: CwlEditorDocumentEnvelope;
  /** Frozen SHA-256 strong validator derived from `envelope`. */
  readonly revision: CwlEditorDocumentRevision;
}

/** Raised when a strong document revision validator cannot be produced. */
export class DocumentEnvelopeRevisionError extends Error {
  /** Create a redacted public revision-generation error. */
  constructor(message: string) {
    super(message);
    this.name = 'DocumentEnvelopeRevisionError';
  }
}

/**
 * Create a SHA-256 revision validator from an envelope object or JSON text.
 *
 * The source is parsed through Inkspan's strict envelope boundary and then
 * canonicalized before hashing, so equivalent supported envelopes produce the
 * same validator regardless of object-property or insignificant-whitespace
 * order. The optional provider exists for dependency injection; omitting it
 * uses the platform Web Cryptography implementation.
 */
export async function createDocumentEnvelopeRevision(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevision> {
  const evidence = await createDocumentEnvelopeRevisionEvidence(
    source,
    limits,
    digestProvider,
  );
  return evidence.revision;
}

/**
 * Create one frozen envelope and the SHA-256 revision derived from that payload.
 *
 * Returning the parsed envelope beside its revision prevents hosts from parsing
 * the source again or pairing the validator with a later document read. The
 * envelope contains full document content and must be protected accordingly.
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
 * Create a SHA-256 revision validator from strict UTF-8 envelope bytes.
 *
 * Noncanonical but otherwise valid input is parsed and reserialized to the RFC
 * 8785 representation before hashing. Byte-order marks, malformed UTF-8,
 * duplicate names, unsupported versions, and resource-limit violations fail
 * before the digest provider runs.
 */
export async function createDocumentEnvelopeRevisionBytes(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevision> {
  const evidence = await createDocumentEnvelopeRevisionEvidenceBytes(
    source,
    limits,
    digestProvider,
  );
  return evidence.revision;
}

/**
 * Create frozen revision evidence from strict UTF-8 envelope bytes.
 *
 * The returned envelope is the validated normalized payload whose RFC 8785
 * canonical bytes produced the paired SHA-256 validator.
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
 * Hash an envelope already returned by Inkspan's strict envelope boundary.
 *
 * This package-internal integration helper prevents imperative editor exports
 * from attempting to parse bare ProseMirror JSON as an envelope or cloning an
 * already validated document a second time.
 */
export async function createValidatedDocumentEnvelopeRevision(
  envelope: CwlEditorDocumentEnvelope,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevision> {
  const evidence = await createValidatedDocumentEnvelopeRevisionEvidence(
    envelope,
    digestProvider,
  );
  return evidence.revision;
}

/**
 * Pair an already validated envelope with the revision from its canonical bytes.
 *
 * This integration helper retains the exact frozen envelope supplied by the
 * caller, adding no second parse, clone, canonicalization, digest, or editor
 * read beyond the work required to create the revision itself.
 */
export async function createValidatedDocumentEnvelopeRevisionEvidence(
  envelope: CwlEditorDocumentEnvelope,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence> {
  const provider = resolveDigestProvider(digestProvider);
  const canonicalBytes = encodeValidatedDocumentEnvelope(envelope);
  let digestResult: ArrayBuffer;
  try {
    digestResult = await provider.digest('SHA-256', canonicalBytes);
  } catch {
    throw new DocumentEnvelopeRevisionError(
      'Document envelope SHA-256 digest could not be created',
    );
  }

  let digestBytes: Uint8Array;
  try {
    if (ARRAY_BUFFER_BYTE_LENGTH_GETTER.call(digestResult) !== 32) {
      throw new TypeError('invalid digest result');
    }
    digestBytes = new Uint8Array(digestResult);
  } catch {
    throw new DocumentEnvelopeRevisionError(
      'Document envelope provider must return a 32-byte SHA-256 digest',
    );
  }

  const digestHex = bytesToLowercaseHex(digestBytes);
  const revision: CwlEditorDocumentRevision = Object.freeze({
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  });
  return Object.freeze({ envelope, revision });
}

function resolveDigestProvider(
  digestProvider: DocumentEnvelopeDigestProvider | null | undefined,
): DocumentEnvelopeDigestProvider {
  if (digestProvider === null) {
    throw new DocumentEnvelopeRevisionError(
      'A SHA-256 digest provider is unavailable',
    );
  }
  if (digestProvider !== undefined) return digestProvider;

  let platformProvider: SubtleCrypto | undefined;
  try {
    platformProvider = globalThis.crypto?.subtle;
  } catch {
    throw new DocumentEnvelopeRevisionError(
      'A SHA-256 digest provider is unavailable',
    );
  }
  if (platformProvider === undefined) {
    throw new DocumentEnvelopeRevisionError(
      'A SHA-256 digest provider is unavailable',
    );
  }
  return platformProvider;
}

function bytesToLowercaseHex(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, '0');
  }
  return result;
}
