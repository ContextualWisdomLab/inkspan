import { Base64SizeError } from '../converter/base64.js';

/** Bounded raster data-URI prefix recognized before payload validation. */
const INLINE_RASTER_SOURCE_PREFIX_PATTERN =
  /^data:image\/(?:png|jpe?g|gif|webp|avif|apng|bmp|x-icon|vnd\.microsoft\.icon);base64,/i;

/** One canonical base64 payload code unit; padding is handled separately. */
const BASE64_PAYLOAD_CODE_UNIT_PATTERN = /^[A-Za-z0-9+/]$/;

/** Fixed public categories that reveal no caller-defined scheme label. */
const PUBLIC_IMAGE_SOURCE_SCHEME_PATTERN =
  /^(?:data|https?|blob|file|javascript)$/i;

/** Maximum untrusted prefix inspected while classifying source metadata. */
const IMAGE_SOURCE_PREFIX_INSPECTION_CODE_UNITS = 64;

/** Return a bounded, payload-free category for an untrusted image source. */
function redactImageSource(source: unknown): string {
  if (typeof source !== 'string') return `<${typeof source}>`;
  if (source.length === 0) return '<empty>';
  if (source.startsWith('//')) return '//<redacted>';
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(
    source.slice(0, IMAGE_SOURCE_PREFIX_INSPECTION_CODE_UNITS),
  )?.[1];
  if (scheme) {
    if (PUBLIC_IMAGE_SOURCE_SCHEME_PATTERN.test(scheme)) {
      return `${scheme.toLowerCase()}:<redacted>`;
    }
    return '<scheme-redacted>';
  }
  return '<unrecognized>';
}

/** Return decoded bytes for a source whose strict base64 shape is known. */
function inlineRasterByteLength(source: string, payloadOffset: number): number {
  const payloadLength = source.length - payloadOffset;
  const padding = source.endsWith('==') ? 2 : Number(source.endsWith('='));
  return (payloadLength / 4) * 3 - padding;
}

/**
 * Validate the strict raster/base64 grammar without decoding or whole-source regex work.
 *
 * The MIME/prefix regex sees only a bounded prefix. Payload code units are then
 * inspected incrementally so malformed-source precedence remains authoritative
 * even for oversized candidates. Canonical padding is inferred only from the
 * final one or two code units; any earlier `=` is rejected by the payload scan.
 */
function strictInlineRasterPayloadOffset(source: string): number | null {
  const prefixMatch = INLINE_RASTER_SOURCE_PREFIX_PATTERN.exec(
    source.slice(0, IMAGE_SOURCE_PREFIX_INSPECTION_CODE_UNITS),
  );
  if (!prefixMatch) return null;

  const payloadOffset = prefixMatch[0].length;
  const payloadLength = source.length - payloadOffset;
  if (payloadLength < 4 || payloadLength % 4 !== 0) return null;

  const padding = source.endsWith('==') ? 2 : Number(source.endsWith('='));
  const payloadDataEnd = source.length - padding;
  for (let index = payloadOffset; index < payloadDataEnd; index += 1) {
    if (!BASE64_PAYLOAD_CODE_UNIT_PATTERN.test(source.charAt(index))) {
      return null;
    }
  }
  return payloadOffset;
}

/** Reject malformed public byte ceilings without coercion or intent inference. */
function assertValidInlineImageByteLimit(maxSizeBytes: number): void {
  if (!Number.isSafeInteger(maxSizeBytes) || maxSizeBytes < 0) {
    throw new RangeError(
      'inline image byte limit must be a non-negative safe integer',
    );
  }
}

/** Error thrown when an image source violates Inkspan's inline raster policy. */
export class Base64ImageSourceError extends Error {
  /** Redacted source category safe for logs and host telemetry. */
  readonly sourcePreview: string;

  constructor(source: unknown) {
    const sourcePreview = redactImageSource(source);
    super(
      `Image source must be a strict inline base64 raster data URI (${sourcePreview}).`,
    );
    this.name = 'Base64ImageSourceError';
    this.sourcePreview = sourcePreview;
  }
}

/**
 * Validate an untrusted image source without trimming or normalizing it.
 *
 * Accepted MIME types are PNG, JPEG/JPG, GIF, WebP, AVIF, APNG, BMP, and ICO.
 * SVG and every non-data source are rejected. A positive byte limit is applied
 * to the decoded payload; `0` disables only the size limit, not validation.
 */
export function validateInlineImageSource(
  source: unknown,
  maxSizeBytes: number,
): string {
  assertValidInlineImageByteLimit(maxSizeBytes);
  if (typeof source !== 'string' || source.length === 0) {
    throw new Base64ImageSourceError(source);
  }

  const payloadOffset = strictInlineRasterPayloadOffset(source);
  if (payloadOffset === null) {
    throw new Base64ImageSourceError(source);
  }

  if (maxSizeBytes > 0) {
    const bytes = inlineRasterByteLength(source, payloadOffset);
    if (bytes > maxSizeBytes) {
      throw new Base64SizeError(bytes, maxSizeBytes);
    }
  }
  return source;
}
