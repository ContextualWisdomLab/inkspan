/**
 * Headless deterministic Markdown/HTML conversion surface.
 *
 * This package barrel intentionally excludes React, TipTap editor/extension
 * runtime, collaboration providers, transport, persistence, credentials, and
 * model authority. It exposes only deterministic conversion/projection APIs.
 */
export {
  htmlToMarkdown,
  markdownToEmailHtml,
  markdownToHtml,
  normalizeMarkdown,
} from './serializer.js';
export type {
  HtmlToMarkdownOptions,
  MarkdownToEmailHtmlOptions,
} from './serializer.js';
export {
  htmlToPlainText,
  markdownToPlainText,
} from './plainText.js';
export type { PlainTextOptions } from './plainText.js';
