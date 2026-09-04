import {
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

const INVALID_UNICODE_MESSAGE =
  'Document envelope must contain valid Unicode scalar strings';
const NEGATIVE_ZERO_MESSAGE =
  'Document envelope must not contain negative zero';
const UTF8_ENCODER = new TextEncoder();

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

/** Encode a canonical Inkspan envelope as UTF-8 bytes without a BOM. */
export function encodeDocumentEnvelope(
  source: unknown,
): Uint8Array<ArrayBuffer> {
  return encodeValidatedDocumentEnvelope(parseDocumentEnvelope(source));
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
): Uint8Array<ArrayBuffer> {
  return UTF8_ENCODER.encode(
    serializeValidatedDocumentEnvelope(envelope),
  );
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
