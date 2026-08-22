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

/** Error thrown when a string is not valid forgiving-base64 data. */
export class Base64ParseError extends Error {
  constructor() {
    super('String is not valid base64 data.');
    this.name = 'Base64ParseError';
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

const DATA_URI_RE = /^\s*data:([^;,]*)?((?:;[^;,]+)*)?,([\s\S]*)$/;
const CANONICAL_BASE64_RE =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const FORGIVING_BASE64_ALPHABET_RE = /^[A-Za-z0-9+/]*$/;
const FORGIVING_BASE64_RAW_RE =
  /^[A-Za-z0-9+/\t\n\f\r ]*(?:=[\t\n\f\r ]*){0,2}$/;
const HEX_BYTE_RE = /^[0-9a-f]{2}$/i;
const INVALID_OPTIONS_MESSAGE = 'converter options are invalid.';
const INVALID_BINARY_INPUT_MESSAGE = 'converter binary input is invalid.';
const INVALID_BLOB_INPUT_MESSAGE = 'converter Blob input is invalid.';
const INVALID_BASE64_INPUT_MESSAGE = 'base64 input must be a string.';
const MAX_MIME_TYPE_CODE_UNITS = 1_024;
const TEXT_DECODER = new TextDecoder();
const TEXT_DECODER_DECODE = TextDecoder.prototype.decode;
const ARRAY_BUFFER_IS_VIEW = ArrayBuffer.isView;
const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  'byteLength',
)!.get!;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  'buffer',
)!.get!;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  'byteOffset',
)!.get!;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  'byteLength',
)!.get!;
const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)!.get!;
const DATA_VIEW_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  'buffer',
)!.get!;
const DATA_VIEW_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  'byteOffset',
)!.get!;
const DATA_VIEW_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  DataView.prototype,
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
const BLOB_ARRAY_BUFFER_METHOD = Object.getOwnPropertyDescriptor(
  Blob.prototype,
  'arrayBuffer',
)?.value as unknown;

type BindableBufferFrom = (...args: never[]) => unknown;
interface BufferAuthority {
  from: BindableBufferFrom;
}

/** Capture Node's Buffer.from authority when present without mutating globals. */
export function resolveNodeBufferFrom(
  buffer: BufferAuthority | undefined,
): BindableBufferFrom | undefined {
  if (buffer === undefined) return undefined;
  return buffer.from.bind(buffer);
}

const NODE_BUFFER_FROM = resolveNodeBufferFrom(
  globalThis.Buffer as unknown as BufferAuthority | undefined,
) as typeof globalThis.Buffer.from | undefined;
const hasBuffer = typeof NODE_BUFFER_FROM === 'function';

interface Uint8ArraySlots {
  buffer: ArrayBufferLike;
  byteOffset: number;
  byteLength: number;
}

/** Read genuine live Uint8Array slots without evaluating caller-owned properties. */
function readUint8ArraySlots(input: unknown): Uint8ArraySlots {
  try {
    if (TYPED_ARRAY_TAG_GETTER.call(input) !== 'Uint8Array') {
      throw new TypeError(INVALID_BINARY_INPUT_MESSAGE);
    }
    const slots = {
      buffer: TYPED_ARRAY_BUFFER_GETTER.call(input) as ArrayBufferLike,
      byteOffset: TYPED_ARRAY_BYTE_OFFSET_GETTER.call(input) as number,
      byteLength: TYPED_ARRAY_BYTE_LENGTH_GETTER.call(input) as number,
    };
    const probe = new Uint8Array(
      slots.buffer,
      slots.byteOffset,
      slots.byteLength,
    );
    void probe;
    return slots;
  } catch {
    throw new TypeError(INVALID_BINARY_INPUT_MESSAGE);
  }
}

/** Read a genuine live ArrayBuffer view's range without caller-owned accessors. */
function readArrayBufferViewSlots(input: ArrayBufferView): Uint8ArraySlots {
  try {
    const slots = TYPED_ARRAY_TAG_GETTER.call(input) !== undefined
      ? {
          buffer: TYPED_ARRAY_BUFFER_GETTER.call(input) as ArrayBufferLike,
          byteOffset: TYPED_ARRAY_BYTE_OFFSET_GETTER.call(input) as number,
          byteLength: TYPED_ARRAY_BYTE_LENGTH_GETTER.call(input) as number,
        }
      : {
          buffer: DATA_VIEW_BUFFER_GETTER.call(input) as ArrayBufferLike,
          byteOffset: DATA_VIEW_BYTE_OFFSET_GETTER.call(input) as number,
          byteLength: DATA_VIEW_BYTE_LENGTH_GETTER.call(input) as number,
        };
    const probe = new Uint8Array(
      slots.buffer,
      slots.byteOffset,
      slots.byteLength,
    );
    void probe;
    return slots;
  } catch {
    throw new TypeError(INVALID_BINARY_INPUT_MESSAGE);
  }
}

/** Encode raw bytes to a base64 string. Works in Node and the browser. */
export function bytesToBase64(bytes: Uint8Array): string {
  const { buffer, byteOffset, byteLength } = readUint8ArraySlots(bytes);
  const view = new Uint8Array(buffer, byteOffset, byteLength);
  /* v8 ignore start -- browser-only fallback: Node and jsdom always provide Buffer */
  if (!hasBuffer) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < view.length; i += chunkSize) {
      const chunk = view.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    // eslint-disable-next-line no-undef
    return btoa(binary);
  }
  /* v8 ignore stop */
  return NODE_BUFFER_FROM!(buffer, byteOffset, byteLength).toString('base64');
}

/**
 * Normalize and validate the exact input accepted by WHATWG forgiving-base64.
 * Validation happens before either environment-specific decoder runs so Node
 * and browsers expose the same deterministic acceptance boundary.
 */
function normalizeForgivingBase64(base64: string): string {
  let normalized = base64.replace(/[\t\n\f\r ]+/g, '');

  if (normalized.length % 4 === 0) {
    if (normalized.endsWith('==')) {
      normalized = normalized.slice(0, -2);
    } else if (normalized.endsWith('=')) {
      normalized = normalized.slice(0, -1);
    }
  }

  if (
    normalized.length % 4 === 1 ||
    !FORGIVING_BASE64_ALPHABET_RE.test(normalized)
  ) {
    throw new Base64ParseError();
  }

  return normalized;
}

/** Decode a base64 string to raw bytes. Works in Node and the browser. */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof base64 !== 'string') {
    throw new TypeError(INVALID_BASE64_INPUT_MESSAGE);
  }
  const normalized = normalizeForgivingBase64(base64);
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
  return new Uint8Array(NODE_BUFFER_FROM!(normalized, 'base64'));
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

/** Return bounded platform Blob MIME metadata without invoking caller overrides. */
function readBlobType(input: Blob): string {
  const mimeType = BLOB_TYPE_GETTER.call(input) as string;
  if (mimeType.length > MAX_MIME_TYPE_CODE_UNITS) {
    throw new RangeError(
      'Blob MIME type must not exceed 1024 UTF-16 code units.',
    );
  }
  return mimeType;
}

/** Convert only declared binary inputs to a `Uint8Array` without coercion. */
export function toUint8Array(
  input: ArrayBuffer | ArrayBufferView | Uint8Array,
): Uint8Array {
  if (ARRAY_BUFFER_IS_VIEW(input)) {
    if (TYPED_ARRAY_TAG_GETTER.call(input) === 'Uint8Array') {
      readUint8ArraySlots(input);
      return input as Uint8Array;
    }
    const { buffer, byteOffset, byteLength } = readArrayBufferViewSlots(input);
    return new Uint8Array(buffer, byteOffset, byteLength);
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
  const { buffer, byteOffset, byteLength } = readUint8ArraySlots(bytes);
  const b = new Uint8Array(buffer, byteOffset, byteLength);
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
  const head = TEXT_DECODER_DECODE.call(
    TEXT_DECODER,
    b.subarray(0, Math.min(b.length, 64)),
  ).trimStart();
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

/**
 * Return the decoded size for valid WHATWG forgiving-base64 without first
 * allocating the whitespace-stripped replacement string.
 */
function forgivingBase64DecodedByteLength(payload: string): number | undefined {
  if (!FORGIVING_BASE64_RAW_RE.test(payload)) return undefined;

  let normalizedLength = 0;
  let padding = 0;
  for (let index = 0; index < payload.length; index += 1) {
    const character = payload.charAt(index);
    if (character === '=') {
      normalizedLength += 1;
      padding += 1;
    } else if (FORGIVING_BASE64_ALPHABET_RE.test(character)) {
      normalizedLength += 1;
    }
  }

  if (
    normalizedLength % 4 === 1 ||
    (padding > 0 && normalizedLength % 4 !== 0)
  ) {
    return undefined;
  }

  return Math.floor(((normalizedLength - padding) * 3) / 4);
}

/** Return the UTF-8 byte width used for one Unicode scalar value. */
function utf8ByteLength(codePoint: number): number {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

/** Normalize lone UTF-16 surrogates the same way as `TextEncoder`. */
function scalarValue(codePoint: number): number {
  return codePoint >= 0xd800 && codePoint <= 0xdfff ? 0xfffd : codePoint;
}

/**
 * Validate percent escapes and compute exact decoded bytes without allocating
 * the decoded payload. RFC 2397 percent escapes represent octets directly;
 * unescaped Unicode text is encoded as UTF-8 for the public string API.
 */
function percentEncodedDataUriByteLength(payload: string): number {
  let byteLength = 0;
  for (let index = 0; index < payload.length; index += 1) {
    if (payload.charCodeAt(index) === 0x25) {
      const encodedByte = payload.slice(index + 1, index + 3);
      if (!HEX_BYTE_RE.test(encodedByte)) {
        throw new DataUriParseError(
          'Data URI payload has malformed percent-encoding.',
        );
      }
      byteLength += 1;
      index += 2;
      continue;
    }

    const codePoint = payload.codePointAt(index)!;
    if (codePoint > 0xffff) index += 1;
    byteLength += utf8ByteLength(scalarValue(codePoint));
  }
  return byteLength;
}

/** Write one Unicode scalar value as UTF-8 and return the next output offset. */
function writeUtf8CodePoint(
  output: Uint8Array,
  offset: number,
  codePoint: number,
): number {
  if (codePoint <= 0x7f) {
    output[offset] = codePoint;
    return offset + 1;
  }
  if (codePoint <= 0x7ff) {
    output[offset] = 0xc0 | (codePoint >> 6);
    output[offset + 1] = 0x80 | (codePoint & 0x3f);
    return offset + 2;
  }
  if (codePoint <= 0xffff) {
    output[offset] = 0xe0 | (codePoint >> 12);
    output[offset + 1] = 0x80 | ((codePoint >> 6) & 0x3f);
    output[offset + 2] = 0x80 | (codePoint & 0x3f);
    return offset + 3;
  }
  output[offset] = 0xf0 | (codePoint >> 18);
  output[offset + 1] = 0x80 | ((codePoint >> 12) & 0x3f);
  output[offset + 2] = 0x80 | ((codePoint >> 6) & 0x3f);
  output[offset + 3] = 0x80 | (codePoint & 0x3f);
  return offset + 4;
}

/** Decode a validated non-base64 data-URI payload into exact octets. */
function percentEncodedDataUriToBytes(
  payload: string,
  byteLength: number,
): Uint8Array {
  const output = new Uint8Array(byteLength);
  let offset = 0;
  for (let index = 0; index < payload.length; index += 1) {
    if (payload.charCodeAt(index) === 0x25) {
      output[offset] = Number.parseInt(payload.slice(index + 1, index + 3), 16);
      offset += 1;
      index += 2;
      continue;
    }

    const codePoint = payload.codePointAt(index)!;
    if (codePoint > 0xffff) index += 1;
    offset = writeUtf8CodePoint(output, offset, scalarValue(codePoint));
  }
  return output;
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
  const { byteLength } = readUint8ArraySlots(bytes);
  assertSize(byteLength, maxBytes);
  const mime = mimeType ?? sniffMimeType(bytes) ?? 'application/octet-stream';
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

/** Alias kept for API symmetry with the Blob/File helpers. */
export const arrayBufferToDataUri = bytesToDataUri;

/**
 * Read a Blob's bytes across environments without consulting caller-owned
 * instance members. Capture the platform read capability at module evaluation
 * so a later prototype replacement cannot become payload authority, while a
 * missing live platform member still selects the documented fallbacks.
 */
async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  const hasPlatformArrayBuffer =
    Object.getOwnPropertyDescriptor(Blob.prototype, 'arrayBuffer') !== undefined;
  if (hasPlatformArrayBuffer && typeof BLOB_ARRAY_BUFFER_METHOD === 'function') {
    const buffer = await (BLOB_ARRAY_BUFFER_METHOD as (
      this: Blob,
    ) => Promise<ArrayBuffer>).call(blob);
    return new Uint8Array(buffer);
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
  const blobType =
    mimeType !== undefined && mimeType.length > 0 ? '' : readBlobType(blob);
  const bytes = await readBlobBytes(blob);
  assertSize(bytes.byteLength, maxBytes);
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
  const match = DATA_URI_RE.exec(dataUri);
  if (!match) {
    throw new DataUriParseError('String is not a valid data URI.');
  }
  const declaredMimeType = match[1] ?? '';
  if (declaredMimeType.length > MAX_MIME_TYPE_CODE_UNITS) {
    throw new DataUriParseError(
      'Data URI MIME type must not exceed 1024 UTF-16 code units.',
    );
  }
  const mimeType = declaredMimeType.length > 0 ? declaredMimeType : 'text/plain';
  const params = match[2] ?? '';
  const isBase64 = /;base64$/i.test(params);
  // Capture group 3 always matches (possibly empty), so `?? ''` is defensive.
  /* v8 ignore next */
  const payload = match[3] ?? '';
  return { mimeType, isBase64, payload };
}

/** `true` when the string is a syntactically valid data URI. */
export function isDataUri(value: string): boolean {
  return typeof value === 'string' && DATA_URI_RE.test(value);
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
      const decodedLength =
        canonicalBase64DecodedByteLength(payload) ??
        forgivingBase64DecodedByteLength(payload);
      if (decodedLength !== undefined) {
        assertSize(decodedLength, maxBytes);
      }
    }
    bytes = base64ToBytes(payload);
  } else {
    const decodedLength = percentEncodedDataUriByteLength(payload);
    assertSize(decodedLength, maxBytes);
    bytes = percentEncodedDataUriToBytes(payload, decodedLength);
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
