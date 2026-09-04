/** Default UTF-8 byte ceiling for one standalone HTML-to-Markdown conversion. */
export const DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES = 16_777_216;

/** Hard public ceiling for an explicitly raised HTML-to-Markdown input limit. */
export const MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES = 67_108_864;

/** Stable redacted resource-bound failures from standalone HTML conversion. */
export type HtmlToMarkdownResourceErrorCode =
  | 'input_too_large'
  | 'invalid_input'
  | 'invalid_configuration';

const ERROR_MESSAGES: Readonly<Record<HtmlToMarkdownResourceErrorCode, string>> =
  Object.freeze({
    input_too_large:
      'HTML-to-Markdown input exceeds the configured byte limit.',
    invalid_input: 'HTML-to-Markdown input must be a string.',
    invalid_configuration:
      'HTML-to-Markdown resource configuration is invalid.',
  });

/** Error whose stable code/message never disclose caller-controlled HTML. */
export class HtmlToMarkdownResourceError extends Error {
  /** Machine-readable rejection category safe for host telemetry. */
  readonly code: HtmlToMarkdownResourceErrorCode;

  /** Create one stable resource-bound conversion error. */
  constructor(code: HtmlToMarkdownResourceErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'HtmlToMarkdownResourceError';
    this.code = code;
  }
}

/** Resolve one optional per-call byte ceiling within the public hard maximum. */
export function resolveHtmlToMarkdownMaxBytes(candidate: unknown): number {
  if (candidate === undefined) return DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES;
  if (
    typeof candidate !== 'number' ||
    !Number.isSafeInteger(candidate) ||
    candidate < 1 ||
    candidate > MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES
  ) {
    throw new HtmlToMarkdownResourceError('invalid_configuration');
  }
  return candidate;
}

/** Reject invalid or oversized HTML before any parser/DOM materialization. */
export function assertHtmlToMarkdownInputSize(
  html: string,
  maxHtmlBytes: number,
): void {
  if (typeof html !== 'string') {
    throw new HtmlToMarkdownResourceError('invalid_input');
  }

  // Every UTF-16 code unit contributes at least one UTF-8 byte. This lower
  // bound avoids allocating a complete TextEncoder result when oversize is
  // already certain.
  if (html.length > maxHtmlBytes) {
    throw new HtmlToMarkdownResourceError('input_too_large');
  }
  if (new TextEncoder().encode(html).byteLength > maxHtmlBytes) {
    throw new HtmlToMarkdownResourceError('input_too_large');
  }
}
