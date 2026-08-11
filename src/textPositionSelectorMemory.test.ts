import { describe, expect, it, vi } from 'vitest';

import { createTextPositionSelector } from './textPositionSelectorEvidence.js';

type SelectorDocument = Parameters<typeof createTextPositionSelector>[0];
type SelectorSelection = Parameters<typeof createTextPositionSelector>[1];

/** Build the minimal immutable projection surface consumed by the selector helper. */
function projectionDocument(text: string): SelectorDocument {
  return {
    content: { size: text.length },
    textBetween: (_from: number, to: number) => text.slice(0, to),
  } as unknown as SelectorDocument;
}

/** Build the minimal ordered structural selection consumed by the selector helper. */
function structuralSelection(from: number, to: number): SelectorSelection {
  return { from, to } as SelectorSelection;
}

describe('text-position selector allocation bounds', () => {
  it('counts Unicode code points without materializing prefix arrays', () => {
    const arrayFrom = vi.spyOn(Array, 'from');

    try {
      const result = createTextPositionSelector(
        projectionDocument(`${'a'.repeat(100_000)}😀`),
        structuralSelection(1, 2),
      );

      expect(result.selector).toEqual({ type: 'TextPositionSelector', start: 1, end: 2 });
      expect(arrayFrom).not.toHaveBeenCalled();
    } finally {
      arrayFrom.mockRestore();
    }
  });

  it('stops grapheme segmentation once each selected boundary is proven', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    let yieldedSegments = 0;

    class BoundedSegmenter {
      segment(input: string): Iterable<{ index: number }> {
        return {
          *[Symbol.iterator]() {
            for (let index = 0; index < input.length; index += 1) {
              yieldedSegments += 1;
              if (index > 2) {
                throw new Error('segmented beyond the selected prefix');
              }
              yield { index };
            }
          },
        };
      }
    }

    Object.defineProperty(Intl, 'Segmenter', {
      configurable: true,
      value: BoundedSegmenter,
    });

    try {
      const result = createTextPositionSelector(
        projectionDocument('a'.repeat(100)),
        structuralSelection(1, 2),
      );

      expect(result.selector).toEqual({ type: 'TextPositionSelector', start: 1, end: 2 });
      expect(yieldedSegments).toBe(5);
    } finally {
      if (descriptor) {
        Object.defineProperty(Intl, 'Segmenter', descriptor);
      } else {
        Reflect.deleteProperty(Intl, 'Segmenter');
      }
    }
  });
});
