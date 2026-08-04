import {
  parseDocumentEnvelope,
  parseDocumentEnvelopeBytes,
  type DocumentEnvelopeLimits,
} from './documentEnvelope.js';
import { encodeDocumentEnvelope } from './documentEnvelopeCanonical.js';

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
  const envelope = parseDocumentEnvelope(source, limits);
  return digestCanonicalEnvelope(envelope, digestProvider);
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
  const envelope = parseDocumentEnvelopeBytes(source, limits);
  return digestCanonicalEnvelope(envelope, digestProvider);
}

async function digestCanonicalEnvelope(
  envelope: unknown,
  digestProvider: DocumentEnvelopeDigestProvider | null | undefined,
): Promise<CwlEditorDocumentRevision> {
  const provider = resolveDigestProvider(digestProvider);
  const canonicalBytes = encodeDocumentEnvelope(envelope);
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
    if (
      Object.prototype.toString.call(digestResult) !== '[object ArrayBuffer]' ||
      digestResult.byteLength !== 32
    ) {
      throw new TypeError('invalid digest result');
    }
    digestBytes = new Uint8Array(digestResult);
  } catch {
    throw new DocumentEnvelopeRevisionError(
      'Document envelope provider must return a 32-byte SHA-256 digest',
    );
  }

  const digestHex = bytesToLowercaseHex(digestBytes);
  return Object.freeze({
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  });
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

  const platformProvider = globalThis.crypto?.subtle;
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
