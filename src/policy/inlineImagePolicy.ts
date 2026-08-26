import {
  Base64SizeError,
  dataUriByteLength,
} from '../converter/base64.js';

/** Strict raster-only data-URI form accepted by Inkspan document surfaces. */
const INLINE_RASTER_SOURCE_PATTERN =
  /^data:image\/(?:png|jpe?g|gif|webp|avif|apng|bmp|x-icon|vnd\.microsoft\.icon);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/i;

/** Return a bounded, payload-free category for an untrusted image source. */
function redactImageSource(source: unknown): string {
  if (typeof source !== 'string') return `<${typeof source}>`;
  if (source.length === 0) return '<empty>';
  if (source.startsWith('//')) return '//<redacted>';
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(source)?.[1];
  if (scheme) return `${scheme.toLowerCase()}:<redacted>`;
  return '<unrecognized>';
}

/** Error thrown when an image source violates Inkspan's inline raster policy. */
export class Base64ImageSourceError extends Error {
  /** Redacted source category safe for logs and host telemetry. */
  readonly sourcePreview: string;

  constructor(source: unknown) {
    const sourcePreview = redactImageSource(source);
    super(
      "This image format can't be inserted. Use a PNG, JPEG, GIF, WebP, AVIF, BMP, or ICO image.",
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
  if (
    typeof source !== 'string' ||
    source.length === 0 ||
    !INLINE_RASTER_SOURCE_PATTERN.test(source)
  ) {
    throw new Base64ImageSourceError(source);
  }
  if (maxSizeBytes > 0) {
    const bytes = dataUriByteLength(source);
    if (bytes > maxSizeBytes) {
      throw new Base64SizeError(bytes, maxSizeBytes);
    }
  }
  return source;
}
