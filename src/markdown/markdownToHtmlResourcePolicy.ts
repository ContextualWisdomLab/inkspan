/** Default UTF-8 byte ceiling for one Markdown-to-HTML conversion. */
export const DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES = 16_777_216;

/** Hard public ceiling for an explicitly raised Markdown-to-HTML input limit. */
export const MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES = 67_108_864;

/** Stable redacted Markdown input/resource failures from conversion. */
export type MarkdownToHtmlResourceErrorCode =
  | 'input_too_large'
  | 'invalid_input'
  | 'invalid_configuration';

const ERROR_MESSAGES: Readonly<Record<MarkdownToHtmlResourceErrorCode, string>> =
  Object.freeze({
    input_too_large:
      'Markdown-to-HTML input exceeds the configured byte limit.',
    invalid_input: 'Markdown-to-HTML input must be a string.',
    invalid_configuration:
      'Markdown-to-HTML resource configuration is invalid.',
  });

/** Error whose stable code/message never disclose caller-controlled Markdown. */
export class MarkdownToHtmlResourceError extends Error {
  /** Machine-readable rejection category safe for host telemetry. */
  readonly code: MarkdownToHtmlResourceErrorCode;

  /** Create one stable resource-bound conversion error. */
  constructor(code: MarkdownToHtmlResourceErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'MarkdownToHtmlResourceError';
    this.code = code;
  }
}

/** Resolve one optional per-call byte ceiling within the public hard maximum. */
export function resolveMarkdownToHtmlMaxBytes(candidate: unknown): number {
  if (candidate === undefined) return DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES;
  if (
    typeof candidate !== 'number' ||
    !Number.isSafeInteger(candidate) ||
    candidate < 1 ||
    candidate > MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES
  ) {
    throw new MarkdownToHtmlResourceError('invalid_configuration');
  }
  return candidate;
}

/** Reject invalid or oversized Markdown before parser materialization. */
export function assertMarkdownToHtmlInputSize(
  markdown: string,
  maxMarkdownBytes: number,
): void {
  if (typeof markdown !== 'string') {
    throw new MarkdownToHtmlResourceError('invalid_input');
  }

  // Every UTF-16 code unit contributes at least one UTF-8 byte. This lower
  // bound avoids allocating a complete TextEncoder result when oversize is
  // already certain.
  if (markdown.length > maxMarkdownBytes) {
    throw new MarkdownToHtmlResourceError('input_too_large');
  }
  if (new TextEncoder().encode(markdown).byteLength > maxMarkdownBytes) {
    throw new MarkdownToHtmlResourceError('input_too_large');
  }
}
