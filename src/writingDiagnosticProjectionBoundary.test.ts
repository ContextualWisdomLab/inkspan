import { Schema, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
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
    block_atom: { group: 'block', atom: true },
    inline_atom: { inline: true, group: 'inline', atom: true },
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

function textOccurrenceRange(
  documentNode: ProseMirrorNode,
  needle: string,
  occurrence = 0,
): Readonly<{ from: number; to: number }> {
  let remaining = occurrence;
  let result: { from: number; to: number } | null = null;
  documentNode.descendants((node, position) => {
    if (!node.isText || result) return;
    let cursor = 0;
    while (cursor <= node.text!.length) {
      const index = node.text!.indexOf(needle, cursor);
      if (index < 0) return;
      if (remaining === 0) {
        result = {
          from: position + index,
          to: position + index + needle.length,
        };
        return;
      }
      remaining -= 1;
      cursor = index + Math.max(needle.length, 1);
    }
  });
  if (!result) throw new Error(`Missing text occurrence: ${needle}`);
  return Object.freeze(result);
}

function expectProjectionError(
  callback: () => unknown,
  code: WritingDiagnosticProjectionError['code'],
): WritingDiagnosticProjectionError {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(WritingDiagnosticProjectionError);
    expect((error as WritingDiagnosticProjectionError).code).toBe(code);
    return error as WritingDiagnosticProjectionError;
  }
  throw new Error(`Expected WritingDiagnosticProjectionError(${code})`);
}

describe('inverse projection structural boundaries', () => {
  it('round-trips a selection spanning two text blocks and their separator', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'Alpha' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Beta' }] },
    ]);
    const first = textOccurrenceRange(documentNode, 'pha');
    const second = textOccurrenceRange(documentNode, 'Be');
    const range = { from: first.from, to: second.to };
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
  });

  it('round-trips the selected occurrence without searching repeated text', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'repeat' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'repeat' }] },
    ]);
    const range = textOccurrenceRange(documentNode, 'repeat', 1);
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
  });

  it('keeps block atoms separated while inline atoms remain inline', () => {
    const documentNode = documentWith([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'a' },
          { type: 'inline_atom' },
          { type: 'text', text: 'b' },
        ],
      },
      { type: 'block_atom' },
    ]);

    expect(buildTextProjectionMap(documentNode).text).toBe('a\uFFFCb\n\uFFFC');
  });

  it('fails closed when a malformed document reports decreasing positions', () => {
    const textNode = (text: string) => ({
      isBlock: false,
      isText: true,
      isLeaf: true,
      inlineContent: false,
      nodeSize: text.length,
      text,
    });
    const malformedDocument = {
      descendants(callback: (node: ReturnType<typeof textNode>, position: number) => void) {
        callback(textNode('a'), 5);
        callback(textNode('b'), 1);
      },
    } as unknown as ProseMirrorNode;

    expectProjectionError(
      () =>
        resolveTextPositionSelector(
          malformedDocument,
          { type: 'TextPositionSelector', start: 0, end: 2 },
          projectionIdentity,
        ),
      'ambiguous_boundary',
    );
  });
});

describe('inverse projection hostile input boundary', () => {
  it('never evaluates projection or selector accessors', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'text' }] },
    ]);
    const projectionGetter = vi.fn(() => TEXT_POSITION_PROJECTION_ID);
    const projection = { version: TEXT_POSITION_PROJECTION_VERSION } as Record<
      string,
      unknown
    >;
    Object.defineProperty(projection, 'id', {
      enumerable: true,
      get: projectionGetter,
    });
    expectProjectionError(
      () =>
        resolveTextPositionSelector(
          documentNode,
          { type: 'TextPositionSelector', start: 0, end: 1 },
          projection as unknown as CwlEditorTextProjectionIdentity,
        ),
      'projection',
    );
    expect(projectionGetter).not.toHaveBeenCalled();

    const selectorGetter = vi.fn(() => 0);
    const selector = {
      type: 'TextPositionSelector',
      end: 1,
    } as Record<string, unknown>;
    Object.defineProperty(selector, 'start', {
      enumerable: true,
      get: selectorGetter,
    });
    expectProjectionError(
      () =>
        resolveTextPositionSelector(
          documentNode,
          selector as unknown as CwlEditorTextPositionSelector,
          projectionIdentity,
        ),
      'selector',
    );
    expect(selectorGetter).not.toHaveBeenCalled();
  });

  it('rejects extra, symbol, inherited, missing, non-enumerable, array, and null fields', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'text' }] },
    ]);
    const validSelector = {
      type: 'TextPositionSelector',
      start: 0,
      end: 1,
    } as const;

    for (const projection of [
      { ...projectionIdentity, extra: true },
      { ...projectionIdentity, [Symbol('private')]: true },
      Object.assign(Object.create({ inherited: true }), projectionIdentity),
      { id: TEXT_POSITION_PROJECTION_ID },
      null,
      [],
    ]) {
      expectProjectionError(
        () =>
          resolveTextPositionSelector(
            documentNode,
            validSelector,
            projection as unknown as CwlEditorTextProjectionIdentity,
          ),
        'projection',
      );
    }

    const hiddenProjection = { ...projectionIdentity } as Record<string, unknown>;
    Object.defineProperty(hiddenProjection, 'id', {
      value: TEXT_POSITION_PROJECTION_ID,
      enumerable: false,
    });
    expectProjectionError(
      () =>
        resolveTextPositionSelector(
          documentNode,
          validSelector,
          hiddenProjection as unknown as CwlEditorTextProjectionIdentity,
        ),
      'projection',
    );
  });

  it('redacts revoked proxies and descriptor failures', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'text' }] },
    ]);
    const revoked = Proxy.revocable({ ...projectionIdentity }, {});
    revoked.revoke();
    const revokedError = expectProjectionError(
      () =>
        resolveTextPositionSelector(
          documentNode,
          { type: 'TextPositionSelector', start: 0, end: 1 },
          revoked.proxy as CwlEditorTextProjectionIdentity,
        ),
      'projection',
    );
    expect(revokedError.message).not.toContain('revoked');

    const selector = new Proxy(
      { type: 'TextPositionSelector', start: 0, end: 1 },
      {
        getOwnPropertyDescriptor() {
          throw new Error('private selector payload');
        },
      },
    );
    const selectorError = expectProjectionError(
      () =>
        resolveTextPositionSelector(
          documentNode,
          selector as CwlEditorTextPositionSelector,
          projectionIdentity,
        ),
      'selector',
    );
    expect(selectorError.message).not.toContain('private selector payload');
  });

  it('accepts exact null-prototype data records', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'text' }] },
    ]);
    const projection = Object.assign(Object.create(null), projectionIdentity);
    const selector = Object.assign(Object.create(null), {
      type: 'TextPositionSelector',
      start: 1,
      end: 3,
    });

    expect(
      resolveTextPositionSelector(documentNode, selector, projection),
    ).toEqual({ from: 2, to: 4 });
  });
});

describe('shared grapheme runtime failure boundary', () => {
  it('converts a throwing Intl.Segmenter getter into one stable error', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'text' }] },
    ]);
    const original = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    try {
      Object.defineProperty(Intl, 'Segmenter', {
        configurable: true,
        get() {
          throw new Error('private runtime detail');
        },
      });
      const error = expectProjectionError(
        () =>
          resolveTextPositionSelector(
            documentNode,
            { type: 'TextPositionSelector', start: 1, end: 2 },
            projectionIdentity,
          ),
        'segmenter_unavailable',
      );
      expect(error.message).not.toContain('private runtime detail');
    } finally {
      if (original) Object.defineProperty(Intl, 'Segmenter', original);
    }
  });

  it('converts a throwing segmenter constructor into one stable error', () => {
    const documentNode = documentWith([
      { type: 'paragraph', content: [{ type: 'text', text: 'text' }] },
    ]);
    const original = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    try {
      Object.defineProperty(Intl, 'Segmenter', {
        configurable: true,
        value: class ThrowingSegmenter {
          constructor() {
            throw new Error('private constructor detail');
          }
        },
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
      if (original) Object.defineProperty(Intl, 'Segmenter', original);
    }
  });
});
