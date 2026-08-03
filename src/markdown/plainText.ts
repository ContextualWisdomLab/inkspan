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

interface PlainTextListToken extends PlainTextToken {
  ordered: boolean;
  start: number | '';
  items: PlainTextListItem[];
}

interface PlainTextCodeToken extends PlainTextToken {
  text: string;
}

interface PlainTextImageToken extends PlainTextToken {
  text: string;
}

interface PlainTextRenderState {
  includeImageAlt: boolean;
  listDepth: number;
}

interface PlainTextSegment {
  kind: 'text' | 'code' | 'structure';
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
 * line breaks, code text, list structure, table cells, link labels, and image
 * alternative text. Raw HTML blocks and link-definition records are omitted
 * instead of interpreted.
 */
export function markdownToPlainText(
  markdown: string,
  options: PlainTextOptions = {},
): string {
  const tokens = plainTextMarked.lexer(markdown) as unknown as PlainTextToken[];
  const state: PlainTextRenderState = {
    includeImageAlt: options.includeImageAlt !== false,
    listDepth: 0,
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
  return markdownToPlainText(
    htmlToMarkdown(html, { includeImageAlt: options.includeImageAlt }),
    options,
  );
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
    return [{ kind: 'code', value: (token as PlainTextCodeToken).text }];
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
  if (token.type === 'list') {
    return renderList(token as PlainTextListToken, state);
  }
  if (token.tokens) return renderTokenSequence(token.tokens, state);
  return [{ kind: 'text', value: token.text ?? '' }];
}

/** Render list markers, ordered starts, and nesting indentation. */
function renderList(
  list: PlainTextListToken,
  state: PlainTextRenderState,
): PlainTextSegment[] {
  const orderedStart = typeof list.start === 'number' ? list.start : 1;
  const itemState: PlainTextRenderState = {
    ...state,
    listDepth: state.listDepth + 1,
  };
  return list.items.flatMap((item, index) => {
    const marker = list.ordered ? `${orderedStart + index}. ` : '- ';
    return [
      {
        kind: 'structure',
        value: `${index > 0 ? '\n' : ''}${'  '.repeat(state.listDepth)}${marker}`,
      },
      ...trimSegmentEdges(renderListItemTokens(item.tokens, itemState)),
    ];
  });
}

/** Render list-item tokens with a compact boundary before a nested list. */
function renderListItemTokens(
  tokens: PlainTextToken[],
  state: PlainTextRenderState,
): PlainTextSegment[] {
  return tokens.flatMap((token, index) => {
    const segments = renderToken(token, state);
    const nextIsList = tokens[index + 1]?.type === 'list';
    const prefix = index > 0 && token.type === 'list'
      ? [{ kind: 'structure' as const, value: '\n' }]
      : [];
    const suffix = BLOCK_TOKEN_TYPES.has(token.type) &&
      segments.some((segment) => segment.value) &&
      !nextIsList
      ? [{ kind: 'text' as const, value: '\n\n' }]
      : [];
    return [...prefix, ...segments, ...suffix];
  });
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

/** Normalize ordinary text while preserving code and structural whitespace. */
function normalizePlainText(segments: PlainTextSegment[]): string {
  const normalized: PlainTextSegment[] = mergeAdjacentTextSegments(segments).map(
    (segment) =>
      segment.kind === 'text'
        ? { kind: 'text', value: normalizeTextSegment(segment.value) }
        : segment,
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

/** Merge neighboring ordinary-text segments without crossing protected segments. */
function mergeAdjacentTextSegments(
  segments: PlainTextSegment[],
): PlainTextSegment[] {
  return segments.reduce<PlainTextSegment[]>((merged, segment) => {
    const previous = merged[merged.length - 1];
    if (previous?.kind === 'text' && segment.kind === 'text') {
      previous.value += segment.value;
    } else {
      merged.push({ ...segment });
    }
    return merged;
  }, []);
}

/** Trim structural outer whitespace without changing protected segment contents. */
function trimSegmentEdges(segments: PlainTextSegment[]): PlainTextSegment[] {
  return segments.map((segment, index) => {
    if (segment.kind !== 'text') return segment;
    let value = segment.value;
    if (index === 0) value = value.trimStart();
    if (index === segments.length - 1) value = value.trimEnd();
    return { kind: 'text', value };
  });
}
