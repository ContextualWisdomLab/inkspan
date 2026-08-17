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
const DIGEST_CREATION_FAILURE_MESSAGE =
  'Document envelope SHA-256 digest could not be created';

/** SHA-256 provider compatible with the Web Cryptography `SubtleCrypto` API. */
export interface DocumentEnvelopeDigestProvider {
  /** Produce a SHA-256 digest for one complete canonical byte sequence. */
  digest(algorithm: 'SHA-256', source: BufferSource): Promise<ArrayBuffer>;
}

/** Package-internal snapshot of one provider capability and its receiver. */
export interface ResolvedDocumentEnvelopeDigestProvider {
  /** Original provider receiver required by Web Crypto-compatible methods. */
  readonly provider: DocumentEnvelopeDigestProvider;
  /** Exact digest callable captured once at the operation boundary. */
  readonly digest: DocumentEnvelopeDigestProvider['digest'];
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
 * The digest capability is captured before the caller-controlled source is
 * parsed. The source then passes Inkspan's strict envelope boundary and is
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
  const resolvedProvider = resolveDocumentEnvelopeDigestProvider(digestProvider);
  const envelope = parseDocumentEnvelope(source, limits);
  return createValidatedDocumentEnvelopeRevisionWithResolvedProvider(
    envelope,
    resolvedProvider,
  );
}

/**
 * Create a SHA-256 revision validator from strict UTF-8 envelope bytes.
 *
 * The digest capability is captured before byte-source processing. Noncanonical
 * but otherwise valid input is parsed and reserialized to the RFC 8785
 * representation before hashing. Byte-order marks, malformed UTF-8, duplicate
 * names, unsupported versions, and resource-limit violations fail before the
 * digest callable runs.
 */
export async function createDocumentEnvelopeRevisionBytes(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevision> {
  const resolvedProvider = resolveDocumentEnvelopeDigestProvider(digestProvider);
  const envelope = parseDocumentEnvelopeBytes(source, limits);
  return createValidatedDocumentEnvelopeRevisionWithResolvedProvider(
    envelope,
    resolvedProvider,
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
  return createValidatedDocumentEnvelopeRevisionWithResolvedProvider(
    envelope,
    resolveDocumentEnvelopeDigestProvider(digestProvider),
  );
}

/**
 * Hash one validated envelope with an already captured provider capability.
 *
 * Multi-revision operations use this package-internal helper so one hostile or
 * mutable provider property cannot change meaning between related revisions.
 */
export async function createValidatedDocumentEnvelopeRevisionWithResolvedProvider(
  envelope: CwlEditorDocumentEnvelope,
  resolvedProvider: ResolvedDocumentEnvelopeDigestProvider,
): Promise<CwlEditorDocumentRevision> {
  const canonicalBytes = encodeValidatedDocumentEnvelope(envelope);
  let digestResult: ArrayBuffer;
  try {
    digestResult = await resolvedProvider.digest.call(
      resolvedProvider.provider,
      'SHA-256',
      canonicalBytes,
    );
  } catch {
    throw new DocumentEnvelopeRevisionError(DIGEST_CREATION_FAILURE_MESSAGE);
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
  return Object.freeze({
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  });
}

/**
 * Capture one usable SHA-256 capability before expensive operation work begins.
 *
 * The returned object keeps the exact callable together with its original
 * receiver. Provider-property reflection failures are converted into the same
 * payload-redacted revision error as invocation failures.
 */
export function resolveDocumentEnvelopeDigestProvider(
  digestProvider: DocumentEnvelopeDigestProvider | null | undefined,
): ResolvedDocumentEnvelopeDigestProvider {
  if (digestProvider === null) {
    throw new DocumentEnvelopeRevisionError(
      'A SHA-256 digest provider is unavailable',
    );
  }

  let provider: DocumentEnvelopeDigestProvider;
  if (digestProvider !== undefined) {
    provider = digestProvider;
  } else {
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
    provider = platformProvider;
  }

  try {
    const digest = provider.digest;
    if (typeof digest !== 'function') {
      throw new TypeError('invalid digest provider');
    }
    return Object.freeze({ provider, digest });
  } catch {
    throw new DocumentEnvelopeRevisionError(DIGEST_CREATION_FAILURE_MESSAGE);
  }
}

function bytesToLowercaseHex(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, '0');
  }
  return result;
}
