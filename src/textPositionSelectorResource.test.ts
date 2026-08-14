import { afterEach, describe, expect, it } from 'vitest';
import { createTextPositionSelector } from './textPositionSelectorEvidence.js';

const originalSegmenter = (
  Intl as unknown as { Segmenter?: unknown }
).Segmenter;

function restoreSegmenter(): void {
  Object.defineProperty(Intl, 'Segmenter', {
    configurable: true,
    writable: true,
    value: originalSegmenter,
  });
}

afterEach(() => {
  restoreSegmenter();
});

describe('text-position selector grapheme resource use', () => {
  it('segments the projected document once for both selection boundaries', () => {
    let segmentCalls = 0;

    class CountingSegmenter {
      segment(input: string): Iterable<{ readonly index: number }> {
        segmentCalls += 1;
        return Array.from({ length: input.length }, (_, index) => ({ index }));
      }
    }

    Object.defineProperty(Intl, 'Segmenter', {
      configurable: true,
      writable: true,
      value: CountingSegmenter,
    });

    const projectedText = 'abcd';
    const documentNode = {
      content: { size: projectedText.length },
      textBetween: (_from: number, to: number): string => projectedText.slice(0, to),
    };
    const selection = { from: 1, to: 3 };

    expect(
      createTextPositionSelector(documentNode as never, selection as never),
    ).toEqual({
      selector: { type: 'TextPositionSelector', start: 1, end: 3 },
      textProjection: { id: 'inkspan-prosemirror-text', version: 1 },
    });
    expect(segmentCalls).toBe(1);
  });
});
