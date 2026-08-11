import {
  markdownToEditorHtml as serializeMarkdownToEditorHtml,
  markdownToEmailHtml as serializeMarkdownToEmailHtml,
  markdownToHtml as serializeMarkdownToHtml,
  normalizeMarkdown as serializeNormalizedMarkdown,
  type MarkdownToEmailHtmlOptions,
} from './serializer.js';
import {
  DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES,
  assertMarkdownToHtmlInputSize,
  resolveMarkdownToHtmlMaxBytes,
} from './markdownToHtmlResourcePolicy.js';

/** Options for public Markdown-to-HTML conversion. */
export interface MarkdownToHtmlOptions {
  /** Maximum UTF-8 bytes accepted before Marked lexing. Defaults to 16 MiB. */
  maxMarkdownBytes?: number;
}

/** Apply the owned default Markdown ceiling before an internal conversion. */
function assertDefaultMarkdownInputSize(markdown: string): void {
  assertMarkdownToHtmlInputSize(markdown, DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES);
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
  const maxMarkdownBytes = resolveMarkdownToHtmlMaxBytes(options.maxMarkdownBytes);
  assertMarkdownToHtmlInputSize(markdown, maxMarkdownBytes);
  return serializeMarkdownToHtml(markdown);
}

/** Normalize bounded Markdown through the existing deterministic serializer. */
export function normalizeMarkdown(markdown: string): string {
  assertDefaultMarkdownInputSize(markdown);
  return serializeNormalizedMarkdown(markdown);
}

/** Convert bounded Markdown to the existing safe email HTML representation. */
export function markdownToEmailHtml(
  markdown: string,
  options: MarkdownToEmailHtmlOptions = {},
): string {
  assertDefaultMarkdownInputSize(markdown);
  return serializeMarkdownToEmailHtml(markdown, options);
}

export type { MarkdownToEmailHtmlOptions } from './serializer.js';
