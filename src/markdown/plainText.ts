import { Marked } from 'marked';
import { htmlToMarkdown } from './serializer.js';

const plainTextMarked = new Marked({
  gfm: true,
  breaks: false,
});

const BLOCK_TOKEN_TYPES = new Set([
  'blockquote',
  'code',
  'heading',
  'hr',
  'list',
  'paragraph',
  'space',
  'table',
]);

interface PlainTextToken {
  type: string;
  text?: string;
  tokens?: PlainTextToken[];
  items?: PlainTextListItem[];
}

interface PlainTextListItem {
  tokens: PlainTextToken[];
}

interface PlainTextTableCell {
  tokens: PlainTextToken[];
}

interface PlainTextTableToken extends PlainTextToken {
  header: PlainTextTableCell[];
  rows: PlainTextTableCell[][];
}

interface PlainTextImageToken extends PlainTextToken {
  text: string;
}

/** Options for Markdown/HTML plain-text projection. */
export interface PlainTextOptions {
  /**
   * Include image alternative text in the projection. Defaults to true.
   * Decorative images with an empty alternative remain silent.
   */
  includeImageAlt?: boolean;
}

/**
 * Project Markdown into deterministic plain text without exposing markup,
 * hyperlink destinations, or inline base64 image payloads.
 *
 * The projection keeps authored reading order, paragraph boundaries, explicit
 * line breaks, code text, list-item boundaries, table cells, link labels, and
 * image alternative text. Raw HTML blocks and link-definition records are
 * omitted instead of interpreted.
 */
export function markdownToPlainText(
  markdown: string,
  options: PlainTextOptions = {},
): string {
  const tokens = plainTextMarked.lexer(markdown) as unknown as PlainTextToken[];
  const includeImageAlt = options.includeImageAlt !== false;
  return normalizePlainText(renderTokenSequence(tokens, includeImageAlt));
}

/**
 * Project HTML into deterministic plain text through Inkspan's existing
 * HTML-to-Markdown normalization boundary.
 *
 * Element names, attributes, hyperlink destinations, and image sources are not
 * emitted. Image alternative text is included unless explicitly disabled.
 */
export function htmlToPlainText(
  html: string,
  options: PlainTextOptions = {},
): string {
  return markdownToPlainText(htmlToMarkdown(html), options);
}

/** Render an ordered token sequence while preserving block boundaries. */
function renderTokenSequence(
  tokens: PlainTextToken[],
  includeImageAlt: boolean,
): string {
  return tokens
    .map((token) => {
      const text = renderToken(token, includeImageAlt);
      return BLOCK_TOKEN_TYPES.has(token.type) && text
        ? `${text}\n\n`
        : text;
    })
    .join('');
}

/** Render one Marked token without emitting source destinations or attributes. */
function renderToken(
  token: PlainTextToken,
  includeImageAlt: boolean,
): string {
  if (token.type === 'image') {
    return includeImageAlt ? (token as PlainTextImageToken).text : '';
  }
  if (token.type === 'html' || token.type === 'def') return '';
  if (token.type === 'br') return '\n';
  if (token.type === 'table') {
    return renderTable(token as PlainTextTableToken, includeImageAlt);
  }
  if (token.items) {
    return token.items
      .map((item) => renderTokenSequence(item.tokens, includeImageAlt).trim())
      .join('\n');
  }
  if (token.tokens) return renderTokenSequence(token.tokens, includeImageAlt);
  return token.text ?? '';
}

/** Render a table with tab-separated cells and line-separated rows. */
function renderTable(
  table: PlainTextTableToken,
  includeImageAlt: boolean,
): string {
  return [table.header, ...table.rows]
    .map((row) =>
      row
        .map((cell) =>
          renderTokenSequence(cell.tokens, includeImageAlt).trim(),
        )
        .join('\t'),
    )
    .join('\n');
}

/** Normalize line endings and redundant spacing in the final projection. */
function normalizePlainText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
