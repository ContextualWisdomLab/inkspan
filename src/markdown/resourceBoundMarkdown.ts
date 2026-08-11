import {
  markdownToEditorHtml as serializeMarkdownToEditorHtml,
  markdownToEmailHtml as serializeMarkdownToEmailHtml,
  markdownToHtml as serializeMarkdownToHtml,
  normalizeMarkdown as serializeNormalizedMarkdown,
} from './serializer.js';
import type { MarkdownToEmailHtmlOptions as SerializerMarkdownToEmailHtmlOptions } from './serializer.js';
import {
  DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES,
  assertMarkdownToHtmlInputSize,
  resolveMarkdownToHtmlMaxBytes,
} from './markdownToHtmlResourcePolicy.js';

const EMAIL_LANGUAGE_TAG_MAX_CODE_UNITS = 256;
const INVALID_EMAIL_LANGUAGE_MESSAGE =
  'Email document language must be a valid BCP 47 language tag within the supported length.';

/** Options for public Markdown-to-HTML conversion. */
export interface MarkdownToHtmlOptions {
  /** Maximum UTF-8 bytes accepted before Marked lexing. Defaults to 16 MiB. */
  maxMarkdownBytes?: number;
}

/** Options for public Markdown normalization. */
export interface NormalizeMarkdownOptions {
  /** Maximum UTF-8 bytes accepted before Marked lexing. Defaults to 16 MiB. */
  maxMarkdownBytes?: number;
}

/** Options for public Markdown-to-email-HTML conversion. */
export interface MarkdownToEmailHtmlOptions
  extends SerializerMarkdownToEmailHtmlOptions {
  /** Maximum UTF-8 bytes accepted before Marked lexing. Defaults to 16 MiB. */
  maxMarkdownBytes?: number;
}

/** Apply the owned default Markdown ceiling before an internal conversion. */
function assertDefaultMarkdownInputSize(markdown: string): void {
  assertMarkdownToHtmlInputSize(markdown, DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES);
}

/** Apply one caller-selectable Markdown ceiling before Marked materialization. */
function assertConfiguredMarkdownInputSize(
  markdown: string,
  maxMarkdownBytes: number | undefined,
): void {
  const resolvedMaxBytes = resolveMarkdownToHtmlMaxBytes(maxMarkdownBytes);
  assertMarkdownToHtmlInputSize(markdown, resolvedMaxBytes);
}

/** Reject invalid or oversized full-document language metadata before Intl work. */
function assertBoundedEmailLanguageTag(value: unknown): void {
  if (value === undefined) return;
  if (
    typeof value !== 'string' ||
    value.length > EMAIL_LANGUAGE_TAG_MAX_CODE_UNITS
  ) {
    throw new RangeError(INVALID_EMAIL_LANGUAGE_MESSAGE);
  }
}

/** Convert bounded Markdown to parser HTML for TipTap ingress. */
export function markdownToEditorHtml(markdown: string): string {
  assertDefaultMarkdownInputSize(markdown);
  return serializeMarkdownToEditorHtml(markdown);
}

/** Convert bounded Markdown to safe standalone HTML. */
export function markdownToHtml(
  markdown: string,
  options: MarkdownToHtmlOptions = {},
): string {
  assertConfiguredMarkdownInputSize(markdown, options.maxMarkdownBytes);
  return serializeMarkdownToHtml(markdown);
}

/** Normalize bounded Markdown through the existing deterministic serializer. */
export function normalizeMarkdown(
  markdown: string,
  options: NormalizeMarkdownOptions = {},
): string {
  assertConfiguredMarkdownInputSize(markdown, options.maxMarkdownBytes);
  return serializeNormalizedMarkdown(markdown);
}

/** Convert bounded Markdown to the existing safe email HTML representation. */
export function markdownToEmailHtml(
  markdown: string,
  options: MarkdownToEmailHtmlOptions = {},
): string {
  const { maxMarkdownBytes, ...serializerOptions } = options;
  assertConfiguredMarkdownInputSize(markdown, maxMarkdownBytes);
  if (serializerOptions.fullDocument === true) {
    assertBoundedEmailLanguageTag(serializerOptions.languageTag);
  }
  return serializeMarkdownToEmailHtml(markdown, serializerOptions);
}
