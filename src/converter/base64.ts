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

/** Coerce any binary-ish input to a `Uint8Array` view without copying twice. */
export function toUint8Array(
  input: ArrayBuffer | ArrayBufferView | Uint8Array,
): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return new Uint8Array(input);
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

/**
 * Encode raw bytes (ArrayBuffer / typed array / Uint8Array) into a base64
 * data URI. MIME is taken from `options.mimeType`, otherwise sniffed, otherwise
 * `application/octet-stream`.
 */
export function bytesToDataUri(
  input: ArrayBuffer | ArrayBufferView | Uint8Array,
  options: EncodeOptions = {},
): string {
  const bytes = toUint8Array(input);
  assertSize(bytes.byteLength, options.maxBytes);
  const mime =
    options.mimeType ?? sniffMimeType(bytes) ?? 'application/octet-stream';
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
  const bytes = await readBlobBytes(blob);
  assertSize(bytes.byteLength, options.maxBytes);
  const mime =
    options.mimeType ||
    (blob.type && blob.type.length > 0 ? blob.type : undefined) ||
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
  return DATA_URI_RE.test(value.trim());
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
  const { mimeType, isBase64, payload } = parseDataUri(dataUri);
  let bytes: Uint8Array;
  if (isBase64) {
    bytes = base64ToBytes(payload);
  } else {
    // Non-base64 data URIs carry percent-encoded text.
    const decoded = decodeURIComponent(payload);
    bytes = new TextEncoder().encode(decoded);
  }
  assertSize(bytes.byteLength, options.maxBytes);
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
