import { describe, expect, it, vi } from 'vitest';

import {
  createTextPositionSelector,
  TextPositionSelectorEvidenceError,
} from './textPositionSelectorEvidence.js';

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

  it('validates both selected boundaries in one grapheme segmentation pass', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    let constructedSegmenters = 0;
    let segmentCalls = 0;
    let yieldedSegments = 0;

    class SinglePassSegmenter {
      constructor() {
        constructedSegmenters += 1;
      }

      segment(input: string): Iterable<{ index: number }> {
        segmentCalls += 1;
        return {
          *[Symbol.iterator]() {
            for (let index = 0; index < input.length; index += 1) {
              yieldedSegments += 1;
              if (index > 2) {
                throw new Error('segmented beyond the selected range');
              }
              yield { index };
            }
          },
        };
      }
    }

    Object.defineProperty(Intl, 'Segmenter', {
      configurable: true,
      value: SinglePassSegmenter,
    });

    try {
      const result = createTextPositionSelector(
        projectionDocument('a'.repeat(100)),
        structuralSelection(1, 2),
      );

      expect(result.selector).toEqual({ type: 'TextPositionSelector', start: 1, end: 2 });
      expect(constructedSegmenters).toBe(1);
      expect(segmentCalls).toBe(1);
      expect(yieldedSegments).toBe(3);
    } finally {
      if (descriptor) {
        Object.defineProperty(Intl, 'Segmenter', descriptor);
      } else {
        Reflect.deleteProperty(Intl, 'Segmenter');
      }
    }
  });

  it('rejects missing grapheme segmentation before projecting document text', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    let projectionCalls = 0;
    const documentNode = {
      content: { size: 0 },
      textBetween: () => {
        projectionCalls += 1;
        return '';
      },
    } as unknown as SelectorDocument;

    Object.defineProperty(Intl, 'Segmenter', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(() => createTextPositionSelector(documentNode, structuralSelection(0, 0))).toThrow(
        new TextPositionSelectorEvidenceError('segmenter_unavailable'),
      );
      expect(projectionCalls).toBe(0);
    } finally {
      if (descriptor) {
        Object.defineProperty(Intl, 'Segmenter', descriptor);
      } else {
        Reflect.deleteProperty(Intl, 'Segmenter');
      }
    }
  });
});
