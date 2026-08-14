import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { createTextPositionSelector } from './textPositionSelectorEvidence.js';

const intlWithSegmenter = Intl as typeof Intl & { Segmenter?: unknown };
const originalSegmenter = intlWithSegmenter.Segmenter;

afterEach(() => {
  Object.defineProperty(intlWithSegmenter, 'Segmenter', {
    configurable: true,
    value: originalSegmenter,
  });
});

describe('text-position selector grapheme traversal', () => {
  it('decides both nearby boundaries with one bounded segmentation pass', () => {
    const projectedText = 'abcdefghijklmnopqrstuvwxyz';
    const documentNode = {
      content: { size: projectedText.length },
      textBetween: (_from: number, to: number) => projectedText.slice(0, to),
    } as unknown as ProseMirrorNode;
    const selection = { from: 1, to: 2 } as Selection;

    let constructions = 0;
    let yieldedSegments = 0;
    class CountingSegmenter {
      constructor() {
        constructions += 1;
      }

      segment(input: string): Iterable<{ readonly index: number }> {
        return {
          *[Symbol.iterator]() {
            for (let index = 0; index < input.length; index += 1) {
              yieldedSegments += 1;
              yield { index };
            }
          },
        };
      }
    }

    Object.defineProperty(intlWithSegmenter, 'Segmenter', {
      configurable: true,
      value: CountingSegmenter,
    });

    expect(createTextPositionSelector(documentNode, selection).selector).toEqual({
      type: 'TextPositionSelector',
      start: 1,
      end: 2,
    });
    expect(constructions).toBe(1);
    expect(yieldedSegments).toBeLessThanOrEqual(3);
  });
});
