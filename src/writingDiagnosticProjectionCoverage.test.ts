import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';
import {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  type CwlEditorTextPositionSelector,
  type CwlEditorTextProjectionIdentity,
} from './textPositionSelectorEvidence.js';
import {
  WritingDiagnosticProjectionError,
  buildTextProjectionMap,
  resolveTextPositionSelector,
} from './writingDiagnosticProjection.js';

const projectionIdentity: CwlEditorTextProjectionIdentity = {
  id: TEXT_POSITION_PROJECTION_ID,
  version: TEXT_POSITION_PROJECTION_VERSION,
};

function emptyTraversalDocument(): ProseMirrorNode {
  return {
    descendants() {
      // Deliberately expose no structural boundary candidate.
    },
  } as unknown as ProseMirrorNode;
}

function expectCode(
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

describe('inverse projection defensive coverage', () => {
  it('marks a projection with no structural candidate as ambiguous', () => {
    expect(buildTextProjectionMap(emptyTraversalDocument())).toEqual({
      text: '',
      boundaryPositions: [null],
      ambiguousBoundaryOffsets: [0],
    });
  });

  it('rejects an unexpected projection key even when the key count matches', () => {
    const projection = {
      id: TEXT_POSITION_PROJECTION_ID,
      unexpected: TEXT_POSITION_PROJECTION_VERSION,
    };

    expectCode(
      () =>
        resolveTextPositionSelector(
          emptyTraversalDocument(),
          { type: 'TextPositionSelector', start: 0, end: 0 },
          projection as unknown as CwlEditorTextProjectionIdentity,
        ),
      'projection',
    );
  });

  it('rejects a same-count symbol key without reflecting its description', () => {
    const privateKey = Symbol('private projection key');
    const projection = {
      id: TEXT_POSITION_PROJECTION_ID,
      [privateKey]: TEXT_POSITION_PROJECTION_VERSION,
    };

    expectCode(
      () =>
        resolveTextPositionSelector(
          emptyTraversalDocument(),
          { type: 'TextPositionSelector', start: 0, end: 0 },
          projection as unknown as CwlEditorTextProjectionIdentity,
        ),
      'projection',
    );
  });

  it('rejects a field that disappears after the exact key inventory', () => {
    const target = {
      type: 'TextPositionSelector',
      start: 0,
      end: 0,
    };
    const selector = new Proxy(target, {
      getOwnPropertyDescriptor(currentTarget, key) {
        if (key === 'start') return undefined;
        return Reflect.getOwnPropertyDescriptor(currentTarget, key);
      },
    });

    expectCode(
      () =>
        resolveTextPositionSelector(
          emptyTraversalDocument(),
          selector as CwlEditorTextPositionSelector,
          projectionIdentity,
        ),
      'selector',
    );
  });
});
