import { Schema, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  createTextPositionSelector,
  type CwlEditorTextPositionSelector,
  type CwlEditorTextProjectionIdentity,
} from './textPositionSelectorEvidence.js';
import {
  WritingDiagnosticProjectionError,
  buildTextProjectionMap,
  resolveTextPositionSelector,
} from './writingDiagnosticProjection.js';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    heading: { content: 'inline*', group: 'block' },
    blockquote: { content: 'block+', group: 'block' },
    bullet_list: { content: 'list_item+', group: 'block' },
    list_item: { content: 'paragraph block*' },
    table: { content: 'table_row+', group: 'block' },
    table_row: { content: 'table_cell+' },
    table_cell: { content: 'paragraph+' },
    hard_break: { inline: true, group: 'inline', selectable: false },
    inline_atom: { inline: true, group: 'inline', atom: true },
    block_atom: { group: 'block', atom: true },
    text: { group: 'inline' },
  },
});

const projectionIdentity: CwlEditorTextProjectionIdentity = {
  id: TEXT_POSITION_PROJECTION_ID,
  version: TEXT_POSITION_PROJECTION_VERSION,
};

function documentWith(content: readonly Record<string, unknown>[]): ProseMirrorNode {
  return schema.nodeFromJSON({ type: 'doc', content });
}

function textRange(
  documentNode: ProseMirrorNode,
  needle: string,
  occurrence = 0,
): Readonly<{ from: number; to: number }> {
  let remaining = occurrence;
  let result: { from: number; to: number } | null = null;
  documentNode.descendants((node, position) => {
    if (!node.isText || result) return;
    let searchFrom = 0;
    while (searchFrom <= node.text!.length) {
      const index = node.text!.indexOf(needle, searchFrom);
      if (index < 0) return;
      if (remaining === 0) {
        result = {
          from: position + index,
          to: position + index + needle.length,
        };
        return;
      }
      remaining -= 1;
      searchFrom = index + Math.max(needle.length, 1);
    }
  });
  if (!result) throw new Error(`Missing text fixture: ${needle}`);
  return Object.freeze(result);
}

function selectorForProjectedText(
  projection: string,
  needle: string,
): CwlEditorTextPositionSelector {
  const codeUnitStart = projection.indexOf(needle);
  if (codeUnitStart < 0) throw new Error(`Missing projection fixture: ${needle}`);
  return {
    type: 'TextPositionSelector',
    start: Array.from(projection.slice(0, codeUnitStart)).length,
    end: Array.from(projection.slice(0, codeUnitStart + needle.length)).length,
  };
}

function expectProjectionError(
  callback: () => unknown,
  code: WritingDiagnosticProjectionError['code'],
): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(WritingDiagnosticProjectionError);
    expect((error as WritingDiagnosticProjectionError).code).toBe(code);
    return;
  }
  throw new Error(`Expected WritingDiagnosticProjectionError(${code})`);
}

describe('buildTextProjectionMap', () => {
  it('matches ProseMirror textBetween for nested blocks, tables, and leaf nodes', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'Alpha' }] },
      { type: 'heading', content: [{ type: 'text', text: '한글😀' }] },
      {
        type: 'bullet_list',
        content: [
          {
            type: 'list_item',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: '첫째' }] },
            ],
          },
          {
            type: 'list_item',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'second' }] },
            ],
          },
        ],
      },
      {
        type: 'table',
        content: [
          {
            type: 'table_row',
            content: [
              {
                type: 'table_cell',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'cell-a' }] },
                ],
              },
              {
                type: 'table_cell',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'cell-b' }] },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'before' },
          { type: 'hard_break' },
          { type: 'inline_atom' },
          { type: 'text', text: 'after' },
        ],
      },
      { type: 'block_atom' },
    ]);

    const result = buildTextProjectionMap(documentNode);

    expect(result.text).toBe(
      documentNode.textBetween(
        0,
        documentNode.content.size,
        '\n',
        '\uFFFC',
      ),
    );
    expect(result.boundaryPositions).toHaveLength(Array.from(result.text).length + 1);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.boundaryPositions)).toBe(true);
    expect(Object.isFrozen(result.ambiguousBoundaryOffsets)).toBe(true);
  });

  it('maps simple text code-point boundaries to exact ProseMirror positions', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'A😀B' }] },
    ]);

    const result = buildTextProjectionMap(documentNode);

    expect(result.text).toBe('A😀B');
    expect(result.boundaryPositions).toEqual([1, 2, 4, 5]);
    expect(result.ambiguousBoundaryOffsets).toEqual([]);
  });
});

describe('resolveTextPositionSelector', () => {
  it('resolves multilingual projected text to the exact structural range', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'English' }] },
      { type: 'heading', content: [{ type: 'text', text: '한글😀문장' }] },
    ]);
    const projection = documentNode.textBetween(
      0,
      documentNode.content.size,
      '\n',
      '\uFFFC',
    );

    expect(
      resolveTextPositionSelector(
        documentNode,
        selectorForProjectedText(projection, '글😀문'),
        projectionIdentity,
      ),
    ).toEqual(textRange(documentNode, '글😀문'));
  });

  it('round-trips exact text selections across multilingual and Unicode fixtures', () => {
    const fixtures = [
      { text: 'Hello world', selected: 'ello' },
      { text: '가나다라마', selected: '나다라' },
      { text: 'A😀B', selected: '😀' },
      { text: 'e\u0301x', selected: 'e\u0301' },
      { text: 'אבגדה', selected: 'בגד' },
    ];

    for (const fixture of fixtures) {
      const documentNode = documentWith([
        { type: 'paragraph', content: [{ type: 'text', text: fixture.text }] },
      ]);
      const range = textRange(documentNode, fixture.selected);
      const evidence = createTextPositionSelector(
        documentNode,
        TextSelection.create(documentNode, range.from, range.to),
      );

      expect(
        resolveTextPositionSelector(
          documentNode,
          evidence.selector,
          evidence.textProjection,
        ),
      ).toEqual(range);
    }
  });

  it('rejects unsupported projection identities', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'text' }] },
    ]);
    const selector = { type: 'TextPositionSelector', start: 1, end: 2 } as const;

    expectProjectionError(
      () =>
        resolveTextPositionSelector(
          documentNode,
          selector,
          { id: 'other', version: 1 } as unknown as CwlEditorTextProjectionIdentity,
        ),
      'projection',
    );
    expectProjectionError(
      () =>
        resolveTextPositionSelector(
          documentNode,
          selector,
          {
            id: TEXT_POSITION_PROJECTION_ID,
            version: 2,
          } as unknown as CwlEditorTextProjectionIdentity,
        ),
      'projection',
    );
  });

  it('rejects malformed, reversed, and out-of-range selectors', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'text' }] },
    ]);
    const selectors = [
      { type: 'Other', start: 0, end: 1 },
      { type: 'TextPositionSelector', start: -1, end: 1 },
      { type: 'TextPositionSelector', start: 0.5, end: 1 },
      { type: 'TextPositionSelector', start: 2, end: 1 },
      { type: 'TextPositionSelector', start: 0, end: 5 },
      { type: 'TextPositionSelector', start: 0, end: Number.POSITIVE_INFINITY },
    ];

    for (const selector of selectors) {
      expectProjectionError(
        () =>
          resolveTextPositionSelector(
            documentNode,
            selector as CwlEditorTextPositionSelector,
            projectionIdentity,
          ),
        'selector',
      );
    }
  });

  it('fails closed when a selector splits a grapheme cluster', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'e\u0301x' }] },
    ]);

    expectProjectionError(
      () =>
        resolveTextPositionSelector(
          documentNode,
          { type: 'TextPositionSelector', start: 1, end: 2 },
          projectionIdentity,
        ),
      'grapheme_boundary',
    );
  });

  it('fails closed when a projected boundary has multiple text positions', () => {
    const documentNode = documentWith([
      { type: 'paragraph' },
      { type: 'paragraph' },
    ]);
    const map = buildTextProjectionMap(documentNode);

    expect(map.text).toBe('');
    expect(map.ambiguousBoundaryOffsets).toEqual([0]);
    expectProjectionError(
      () =>
        resolveTextPositionSelector(
          documentNode,
          { type: 'TextPositionSelector', start: 0, end: 0 },
          projectionIdentity,
        ),
      'ambiguous_boundary',
    );
  });

  it('fails closed when Intl.Segmenter is unavailable', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'text' }] },
    ]);
    const intl = Intl as unknown as { Segmenter?: unknown };
    const original = intl.Segmenter;
    try {
      Object.defineProperty(intl, 'Segmenter', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      expectProjectionError(
        () =>
          resolveTextPositionSelector(
            documentNode,
            { type: 'TextPositionSelector', start: 1, end: 2 },
            projectionIdentity,
          ),
        'segmenter_unavailable',
      );
    } finally {
      Object.defineProperty(intl, 'Segmenter', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});
