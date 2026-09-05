import {
  DEFAULT_DOCUMENT_ENVELOPE_LIMITS,
  DocumentEnvelopeError,
  parseDocumentEnvelope,
  type CwlEditorDocumentEnvelope,
} from './documentEnvelope.js';

interface CanonicalJsonObject {
  readonly [key: string]: CanonicalJsonValue;
}

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[]
  | CanonicalJsonObject;

/** Resource options for canonical document-envelope byte encoding. */
export interface DocumentEnvelopeEncodingOptions {
  /** Maximum canonical UTF-8 bytes returned by the encoder. Defaults to 64 MiB. */
  readonly maxUtf8Bytes?: number;
}

const INVALID_UNICODE_MESSAGE =
  'Document envelope must contain valid Unicode scalar strings';
const NEGATIVE_ZERO_MESSAGE =
  'Document envelope must not contain negative zero';
const INVALID_ENCODING_OPTIONS_MESSAGE =
  'Canonical document envelope encoding options are invalid';
const INVALID_OUTPUT_LIMIT_MESSAGE =
  'Canonical document envelope UTF-8 byte limit must be a positive safe integer';
const OUTPUT_LIMIT_EXCEEDED_MESSAGE =
  'Canonical document envelope exceeds the configured UTF-8 byte limit';

/**
 * Serialize a valid Inkspan envelope to deterministic RFC 8785 JSON.
 *
 * Object property names are sorted recursively by UTF-16 code units, array
 * order is preserved, ECMAScript JSON primitive serialization is used, and no
 * insignificant whitespace is emitted. Lone UTF-16 surrogates and negative
 * zero fail closed under the verified RFC 8785 errata.
 */
export function serializeDocumentEnvelope(source: unknown): string {
  return serializeValidatedDocumentEnvelope(parseDocumentEnvelope(source));
}

/** Encode a canonical Inkspan envelope as bounded UTF-8 bytes without a BOM. */
export function encodeDocumentEnvelope(
  source: unknown,
  options: DocumentEnvelopeEncodingOptions = {},
): Uint8Array<ArrayBuffer> {
  return encodeValidatedDocumentEnvelope(
    parseDocumentEnvelope(source),
    options,
  );
}

/**
 * Serialize an envelope already returned by the strict parser.
 *
 * This internal package helper avoids cloning the complete document a second
 * time when a caller has just completed the fail-closed parse boundary.
 */
export function serializeValidatedDocumentEnvelope(
  envelope: CwlEditorDocumentEnvelope,
): string {
  return serializeCanonicalValue(
    envelope as unknown as CanonicalJsonObject,
  );
}

/** Encode an already-validated envelope without repeating graph validation. */
export function encodeValidatedDocumentEnvelope(
  envelope: CwlEditorDocumentEnvelope,
  options: DocumentEnvelopeEncodingOptions = {},
): Uint8Array<ArrayBuffer> {
  const maxUtf8Bytes = resolveCanonicalOutputMaxBytes(options);
  const serialized = serializeValidatedDocumentEnvelope(envelope);

  // Every valid UTF-8 encoding uses at least one byte per UTF-16 code unit.
  // Reject the common/obvious oversize case before allocating encoded bytes.
  if (serialized.length > maxUtf8Bytes) {
    throw new DocumentEnvelopeError(OUTPUT_LIMIT_EXCEEDED_MESSAGE);
  }

  const encoded = new TextEncoder().encode(serialized);
  if (encoded.byteLength > maxUtf8Bytes) {
    throw new DocumentEnvelopeError(OUTPUT_LIMIT_EXCEEDED_MESSAGE);
  }
  return encoded;
}

function resolveCanonicalOutputMaxBytes(
  options: DocumentEnvelopeEncodingOptions,
): number {
  const configuredMaxUtf8Bytes = readCanonicalOutputMaxBytesOption(options);
  if (configuredMaxUtf8Bytes === undefined) {
    return DEFAULT_DOCUMENT_ENVELOPE_LIMITS.maxUtf8Bytes;
  }
  if (
    typeof configuredMaxUtf8Bytes !== 'number' ||
    !Number.isSafeInteger(configuredMaxUtf8Bytes) ||
    configuredMaxUtf8Bytes <= 0
  ) {
    throw new DocumentEnvelopeError(INVALID_OUTPUT_LIMIT_MESSAGE);
  }
  return configuredMaxUtf8Bytes;
}

function readCanonicalOutputMaxBytesOption(
  options: DocumentEnvelopeEncodingOptions,
): unknown {
  try {
    if (
      typeof options !== 'object' ||
      options === null ||
      Array.isArray(options)
    ) {
      throw new TypeError('invalid encoding options container');
    }

    const prototype = Object.getPrototypeOf(options);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('invalid encoding options prototype');
    }

    const keys = Reflect.ownKeys(options);
    if (keys.some((key) => key !== 'maxUtf8Bytes')) {
      throw new TypeError('unsupported encoding option');
    }
    if (keys.length === 0) return undefined;

    const descriptor = Object.getOwnPropertyDescriptor(
      options,
      'maxUtf8Bytes',
    ) as PropertyDescriptor;
    if (!descriptor.enumerable || !('value' in descriptor)) {
      throw new TypeError('invalid encoding option property');
    }
    return descriptor.value as unknown;
  } catch {
    throw new DocumentEnvelopeError(INVALID_ENCODING_OPTIONS_MESSAGE);
  }
}

function serializeCanonicalValue(value: CanonicalJsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (Object.is(value, -0)) {
      throw new DocumentEnvelopeError(NEGATIVE_ZERO_MESSAGE);
    }
    return JSON.stringify(value) as string;
  }
  if (typeof value === 'string') {
    assertUnicodeScalarString(value);
    return JSON.stringify(value) as string;
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonicalValue).join(',')}]`;
  }

  const objectValue = value as CanonicalJsonObject;
  const keys = Object.keys(objectValue).sort();
  return `{${keys
    .map((key) => {
      assertUnicodeScalarString(key);
      return `${JSON.stringify(key)}:${serializeCanonicalValue(
        objectValue[key],
      )}`;
    })
    .join(',')}}`;
}

function assertUnicodeScalarString(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
        index += 1;
        continue;
      }
      throw new DocumentEnvelopeError(INVALID_UNICODE_MESSAGE);
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new DocumentEnvelopeError(INVALID_UNICODE_MESSAGE);
    }
  }
}
