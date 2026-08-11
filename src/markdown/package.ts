/**
 * Headless deterministic Markdown/HTML conversion surface.
 *
 * This package barrel intentionally excludes React, TipTap editor/extension
 * runtime, collaboration providers, transport, persistence, credentials, and
 * model authority. It exposes only deterministic conversion/projection APIs.
 */
export { htmlToMarkdown } from './serializer.js';
export type { HtmlToMarkdownOptions } from './serializer.js';
export {
  markdownToEmailHtml,
  markdownToHtml,
  normalizeMarkdown,
} from './resourceBoundMarkdown.js';
export type {
  MarkdownToEmailHtmlOptions,
  MarkdownToHtmlOptions,
  NormalizeMarkdownOptions,
} from './resourceBoundMarkdown.js';
export {
  DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES,
  MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES,
  HtmlToMarkdownResourceError,
} from './htmlToMarkdownResourcePolicy.js';
export type { HtmlToMarkdownResourceErrorCode } from './htmlToMarkdownResourcePolicy.js';
export {
  DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES,
  MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES,
  MarkdownToHtmlResourceError,
} from './markdownToHtmlResourcePolicy.js';
export type { MarkdownToHtmlResourceErrorCode } from './markdownToHtmlResourcePolicy.js';
export {
  htmlToPlainText,
  markdownToPlainText,
} from './plainText.js';
export type { PlainTextOptions } from './plainText.js';
