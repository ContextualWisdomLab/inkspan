/**
 * Framework-agnostic base64 / data-URI converter.
 *
 * Zero runtime dependencies, no React, works in both Node.js and the browser.
 * Designed to be reused standalone (e.g. by the naruon / DOM-understanding
 * pipeline) for turning figures into base64 data URIs that an LLM can read
 * directly from the document content.
 *
 * The core primitives:
 *   - encode:  ArrayBuffer / Uint8Array / Blob / File  ->  data URI
 *   - decode:  data URI  ->  bytes / Blob
 *   - sniff:   magic-number MIME detection
 *   - guard:   configurable size limit that throws before you blow up a doc
 */

/** Error thrown when the source or decoded payload exceeds `maxBytes`. */
export class Base64SizeError extends Error {
  readonly bytes: number;
  readonly maxBytes: number;
  constructor(bytes: number, maxBytes: number) {
    super(
      `Payload of ${bytes} bytes exceeds the configured limit of ${maxBytes} bytes.`,
    );
    this.name = 'Base64SizeError';
    this.bytes = bytes;
    this.maxBytes = maxBytes;
  }
}

/** Error thrown when a string is not a well-formed data URI. */
export class DataUriParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataUriParseError';
  }
}

export interface EncodeOptions {
  /**
   * Explicit MIME type. When omitted the bytes are sniffed via magic numbers,
   * falling back to `application/octet-stream`.
   */
  mimeType?: string;
  /**
   * Reject payloads whose decoded byte length exceeds this value. The guard is
   * evaluated against the *raw* (decoded) bytes, not the inflated base64 text.
   */
  maxBytes?: number;
}

/** Structured result of parsing a data URI. */
export interface ParsedDataUri {
  /** MIME type declared in the URI, e.g. `image/png`. */
  mimeType: string;
  /** `true` when the payload was base64-encoded (`;base64`). */
  isBase64: boolean;
  /** The raw payload string exactly as it appeared after the comma. */
  payload: string;
}

const DATA_URI_RE = /^data:([^;,]*)?((?:;[^;,]+)*)?,([\s\S]*)$/;
const CANONICAL_BASE64_RE =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const CANONICAL_PERCENT_ENCODED_ASCII_RE =
  /^(?:[\x00-\x24\x26-\x7f]|%[0-7][0-9a-f])*$/i;
const INVALID_OPTIONS_MESSAGE = 'converter options are invalid.';
const INVALID_BINARY_INPUT_MESSAGE = 'converter binary input is invalid.';
const INVALID_BLOB_INPUT_MESSAGE = 'converter Blob input is invalid.';
const MAX_MIME_TYPE_CODE_UNITS = 1_024;
const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  'byteLength',
)!.get!;
const BLOB_SIZE_GETTER = Object.getOwnPropertyDescriptor(
  Blob.prototype,
  'size',
)!.get!;
const BLOB_TYPE_GETTER = Object.getOwnPropertyDescriptor(
  Blob.prototype,
  'type',
)!.get!;

const hasBuffer = typeof globalThis.Buffer !== 'undefined';

/** Encode raw bytes to a base64 string. Works in Node and the browser. */
export function bytesToBase64(bytes: Uint8Array): string {
  /* v8 ignore start -- browser-only fallback: Node and jsdom always provide Buffer */
  if (!hasBuffer) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    // eslint-disable-next-line no-undef
    return btoa(binary);
  }
  /* v8 ignore stop */
  return globalThis.Buffer.from(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).toString('base64');
}

/** Decode a base64 string to raw bytes. Works in Node and the browser. */
export function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s+/g, '');
  /* v8 ignore start -- browser-only fallback: Node and jsdom always provide Buffer */
  if (!hasBuffer) {
    // eslint-disable-next-line no-undef
    const binary = atob(normalized);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  /* v8 ignore stop */
  return new Uint8Array(globalThis.Buffer.from(normalized, 'base64'));
}

/** Return whether a value carries the platform ArrayBuffer internal slot. */
function isArrayBuffer(input: unknown): input is ArrayBuffer {
  try {
    ARRAY_BUFFER_BYTE_LENGTH_GETTER.call(input);
    return true;
  } catch {
    return false;
  }
}

/** Return the Blob byte length only after the platform internal-slot check. */
function readBlobSize(input: unknown): number {
  try {
    return BLOB_SIZE_GETTER.call(input) as number;
  } catch {
    throw new TypeError(INVALID_BLOB_INPUT_MESSAGE);
  }
}

/** Return platform Blob MIME metadata without invoking caller overrides. */
function readBlobType(input: Blob): string {
  return BLOB_TYPE_GETTER.call(input) as string;
}

/** Convert only declared binary inputs to a `Uint8Array` without coercion. */
export function toUint8Array(
  input: ArrayBuffer | ArrayBufferView | Uint8Array,
): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (isArrayBuffer(input)) return new Uint8Array(input);
  throw new TypeError(INVALID_BINARY_INPUT_MESSAGE);
}

/**
 * Detect a MIME type from the leading magic-number bytes of a payload.
 * Returns `undefined` when nothing recognisable matches so callers can decide
 * their own fallback.
 */
export function sniffMimeType(bytes: Uint8Array): string | undefined {
  const b = bytes;
  if (b.length >= 8) {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a
    ) {
      return 'image/png';
    }
  }
  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return 'image/jpeg';
  }
  // GIF: "GIF87a" / "GIF89a"
  if (
    b.length >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  ) {
    return 'image/gif';
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return 'image/webp';
  }
  // PDF: "%PDF-"
  if (
    b.length >= 5 &&
    b[0] === 0x25 &&
    b[1] === 0x50 &&
    b[2] === 0x44 &&
    b[3] === 0x46 &&
    b[4] === 0x2d
  ) {
    return 'application/pdf';
  }
  // SVG / XML: look for "<svg" or "<?xml" near the start (skipping BOM/space).
  const head = new TextDecoder()
    .decode(b.subarray(0, Math.min(b.length, 64)))
    .trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return 'image/svg+xml';
  }
  return undefined;
}

function assertSize(bytes: number, maxBytes?: number): void {
  if (typeof maxBytes === 'number' && bytes > maxBytes) {
    throw new Base64SizeError(bytes, maxBytes);
  }
}

function resolveMaxBytes(maxBytes: unknown): number | undefined {
  if (maxBytes === undefined) return undefined;
  if (
    typeof maxBytes !== 'number' ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0
  ) {
    throw new RangeError('maxBytes must be a non-negative safe integer.');
  }
  return maxBytes;
}

function readRuntimeOptions(
  options: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  try {
    if (
      typeof options !== 'object' ||
      options === null ||
      Array.isArray(options)
    ) {
      throw new TypeError('invalid options container');
    }

    const prototype = Object.getPrototypeOf(options);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('invalid options prototype');
    }

    const resolved: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of Reflect.ownKeys(options)) {
      if (typeof key !== 'string' || !allowedKeys.includes(key)) {
        throw new TypeError('unknown option');
      }
      const descriptor = Object.getOwnPropertyDescriptor(options, key) as PropertyDescriptor;
      if (!descriptor.enumerable || !('value' in descriptor)) {
        throw new TypeError('invalid option property');
      }
      resolved[key] = descriptor.value as unknown;
    }
    return resolved;
  } catch {
    throw new RangeError(INVALID_OPTIONS_MESSAGE);
  }
}

function resolveEncodeOptions(options: unknown): {
  mimeType: string | undefined;
  maxBytes: number | undefined;
} {
  const values = readRuntimeOptions(options, ['mimeType', 'maxBytes']);
  const mimeType = values.mimeType;
  if (mimeType !== undefined && typeof mimeType !== 'string') {
    throw new RangeError('mimeType must be a string.');
  }
  if (
    typeof mimeType === 'string' &&
    mimeType.length > MAX_MIME_TYPE_CODE_UNITS
  ) {
    throw new RangeError('mimeType must not exceed 1024 UTF-16 code units.');
  }
  return {
    mimeType,
    maxBytes: resolveMaxBytes(values.maxBytes),
  };
}

function resolveDecodeMaxBytes(options: unknown): number | undefined {
  const values = readRuntimeOptions(options, ['maxBytes']);
  return resolveMaxBytes(values.maxBytes);
}

function canonicalBase64DecodedByteLength(payload: string): number | undefined {
  if (!CANONICAL_BASE64_RE.test(payload)) return undefined;
  const padding = payload.endsWith('==')
    ? 2
    : payload.endsWith('=')
      ? 1
      : 0;
  return (payload.length / 4) * 3 - padding;
}

function canonicalPercentEncodedAsciiDecodedByteLength(
  payload: string,
): number | undefined {
  if (!CANONICAL_PERCENT_ENCODED_ASCII_RE.test(payload)) return undefined;
  let escapeCount = 0;
  for (let index = 0; index < payload.length; index += 1) {
    if (payload.charCodeAt(index) === 0x25) {
      escapeCount += 1;
      index += 2;
    }
  }
  return payload.length - escapeCount * 2;
}

/**
 * Encode raw bytes (ArrayBuffer / typed array / Uint8Array) into a base64
 * data URI. MIME is taken from `options.mimeType`, otherwise sniffed, otherwise
 * `application/octet-stream`.
 */
export function bytesToDataUri(
  input: ArrayBuffer | ArrayBufferView | Uint8Array,
  options: EncodeOptions = {},
): string {
  const { mimeType, maxBytes } = resolveEncodeOptions(options);
  const bytes = toUint8Array(input);
  assertSize(bytes.byteLength, maxBytes);
  const mime = mimeType ?? sniffMimeType(bytes) ?? 'application/octet-stream';
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

/** Alias kept for API symmetry with the Blob/File helpers. */
export const arrayBufferToDataUri = bytesToDataUri;

/**
 * Read a Blob's bytes across environments. Prefers the standard
 * `Blob.arrayBuffer()`, falling back to `FileReader` (jsdom / older DOMs that
 * do not implement `arrayBuffer`) and finally to the `Response` wrapper.
 */
async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () =>
        reject(reader.error ?? new Error('FileReader failed to read Blob.'));
      reader.readAsArrayBuffer(blob);
    });
  }
  const buffer = await new Response(blob).arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Read a Blob or File and encode it as a base64 data URI. Uses the Blob's own
 * `type` when present, otherwise sniffs the bytes. Works without a modern DOM
 * by falling back to `FileReader` / `Response`.
 */
export async function blobToDataUri(
  blob: Blob,
  options: EncodeOptions = {},
): Promise<string> {
  const { mimeType, maxBytes } = resolveEncodeOptions(options);
  assertSize(readBlobSize(blob), maxBytes);
  const bytes = await readBlobBytes(blob);
  assertSize(bytes.byteLength, maxBytes);
  const blobType = readBlobType(blob);
  const mime =
    mimeType ||
    (blobType.length > 0 ? blobType : undefined) ||
    sniffMimeType(bytes) ||
    'application/octet-stream';
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

/** Convenience alias — a `File` is a `Blob`, but the name documents intent. */
export function fileToDataUri(
  file: Blob,
  options: EncodeOptions = {},
): Promise<string> {
  return blobToDataUri(file, options);
}

/**
 * Parse a data URI into its structural parts without decoding the payload.
 * Throws `DataUriParseError` on malformed input.
 */
export function parseDataUri(dataUri: string): ParsedDataUri {
  if (typeof dataUri !== 'string') {
    throw new DataUriParseError('String is not a valid data URI.');
  }
  const match = DATA_URI_RE.exec(dataUri.trim());
  if (!match) {
    throw new DataUriParseError('String is not a valid data URI.');
  }
  const mimeType = match[1] && match[1].length > 0 ? match[1] : 'text/plain';
  const params = match[2] ?? '';
  const isBase64 = /;base64/i.test(params);
  // Capture group 3 always matches (possibly empty), so `?? ''` is defensive.
  /* v8 ignore next */
  const payload = match[3] ?? '';
  return { mimeType, isBase64, payload };
}

/** `true` when the string is a syntactically valid data URI. */
export function isDataUri(value: string): boolean {
  return typeof value === 'string' && DATA_URI_RE.test(value.trim());
}

export interface DecodedDataUri {
  mimeType: string;
  bytes: Uint8Array;
}

/**
 * Decode a data URI to its MIME type and raw bytes. Handles both base64 and
 * URL-encoded (percent-escaped / plain) payloads. Enforces an optional
 * `maxBytes` guard on the decoded output.
 */
export function dataUriToBytes(
  dataUri: string,
  options: { maxBytes?: number } = {},
): DecodedDataUri {
  const maxBytes = resolveDecodeMaxBytes(options);
  const { mimeType, isBase64, payload } = parseDataUri(dataUri);
  let bytes: Uint8Array;
  if (isBase64) {
    if (maxBytes !== undefined) {
      const decodedLength = canonicalBase64DecodedByteLength(payload);
      if (decodedLength !== undefined) {
        assertSize(decodedLength, maxBytes);
      }
    }
    bytes = base64ToBytes(payload);
  } else {
    if (maxBytes !== undefined) {
      const decodedLength = canonicalPercentEncodedAsciiDecodedByteLength(payload);
      if (decodedLength !== undefined) {
        assertSize(decodedLength, maxBytes);
      }
    }
    // Non-base64 data URIs carry percent-encoded text. `decodeURIComponent`
    // throws a raw `URIError` on malformed escapes (e.g. `%`, `%ZZ`); surface
    // the module's documented `DataUriParseError` instead so callers guarding
    // the parse contract handle adversarial input rather than crash.
    let decoded: string;
    try {
      decoded = decodeURIComponent(payload);
    } catch {
      throw new DataUriParseError(
        'Data URI payload has malformed percent-encoding.',
      );
    }
    bytes = new TextEncoder().encode(decoded);
  }
  assertSize(bytes.byteLength, maxBytes);
  return { mimeType, bytes };
}

/** Decode a data URI directly into a Blob (browser or Node >= 18). */
export function dataUriToBlob(
  dataUri: string,
  options: { maxBytes?: number } = {},
): Blob {
  const { mimeType, bytes } = dataUriToBytes(dataUri, options);
  // Copy into a fresh ArrayBuffer-backed view to satisfy the strict
  // `BlobPart` typing (Uint8Array<ArrayBuffer>) across TS lib versions.
  const part = bytes.slice() as unknown as BlobPart;
  return new Blob([part], { type: mimeType });
}

/** The decoded byte length of a data URI without materialising a Blob. */
export function dataUriByteLength(dataUri: string): number {
  return dataUriToBytes(dataUri).bytes.byteLength;
}
