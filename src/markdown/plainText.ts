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

interface PlainTextRenderState {
  includeImageAlt: boolean;
}

interface PlainTextSegment {
  kind: 'text' | 'code';
  value: string;
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
  const state: PlainTextRenderState = {
    includeImageAlt: options.includeImageAlt !== false,
  };
  return normalizePlainText(renderTokenSequence(tokens, state));
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
  state: PlainTextRenderState,
): PlainTextSegment[] {
  return tokens.flatMap((token) => {
    const segments = renderToken(token, state);
    return BLOCK_TOKEN_TYPES.has(token.type) &&
      segments.some((segment) => segment.value)
      ? [...segments, { kind: 'text', value: '\n\n' }]
      : segments;
  });
}

/** Render one Marked token without emitting source destinations or attributes. */
function renderToken(
  token: PlainTextToken,
  state: PlainTextRenderState,
): PlainTextSegment[] {
  if (token.type === 'code' || token.type === 'codespan') {
    return [{ kind: 'code', value: token.text ?? '' }];
  }
  if (token.type === 'image') {
    return [
      {
        kind: 'text',
        value: state.includeImageAlt
          ? (token as PlainTextImageToken).text
          : '',
      },
    ];
  }
  if (token.type === 'html' || token.type === 'def') return [];
  if (token.type === 'br') return [{ kind: 'text', value: '\n' }];
  if (token.type === 'table') {
    return renderTable(token as PlainTextTableToken, state);
  }
  if (token.items) {
    return token.items.flatMap((item, index) => [
      ...(index > 0 ? [{ kind: 'text' as const, value: '\n' }] : []),
      ...trimSegmentEdges(renderTokenSequence(item.tokens, state)),
    ]);
  }
  if (token.tokens) return renderTokenSequence(token.tokens, state);
  return [{ kind: 'text', value: token.text ?? '' }];
}

/** Render a table with tab-separated cells and line-separated rows. */
function renderTable(
  table: PlainTextTableToken,
  state: PlainTextRenderState,
): PlainTextSegment[] {
  return [table.header, ...table.rows].flatMap((row, rowIndex) => [
    ...(rowIndex > 0 ? [{ kind: 'text' as const, value: '\n' }] : []),
    ...row.flatMap((cell, cellIndex) => [
      ...(cellIndex > 0 ? [{ kind: 'text' as const, value: '\t' }] : []),
      ...trimSegmentEdges(renderTokenSequence(cell.tokens, state)),
    ]),
  ]);
}

/** Normalize ordinary text while preserving code-token whitespace verbatim. */
function normalizePlainText(segments: PlainTextSegment[]): string {
  const normalized = mergeAdjacentTextSegments(segments).map((segment) =>
    segment.kind === 'code'
      ? segment
      : { kind: 'text', value: normalizeTextSegment(segment.value) },
  );
  return trimSegmentEdges(normalized)
    .map((segment) => segment.value)
    .join('');
}

/** Normalize line endings and redundant spacing in an ordinary-text segment. */
function normalizeTextSegment(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

/** Merge neighboring ordinary-text segments without crossing code boundaries. */
function mergeAdjacentTextSegments(
  segments: PlainTextSegment[],
): PlainTextSegment[] {
  return segments.reduce<PlainTextSegment[]>((merged, segment) => {
    const previous = merged.at(-1);
    if (previous?.kind === 'text' && segment.kind === 'text') {
      previous.value += segment.value;
    } else {
      merged.push({ ...segment });
    }
    return merged;
  }, []);
}

/** Trim structural outer whitespace without changing code segment contents. */
function trimSegmentEdges(segments: PlainTextSegment[]): PlainTextSegment[] {
  return segments.map((segment, index) => {
    if (segment.kind === 'code') return segment;
    let value = segment.value;
    if (index === 0) value = value.trimStart();
    if (index === segments.length - 1) value = value.trimEnd();
    return { kind: 'text', value };
  });
}
