import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CwlEditorHandle } from '../types.js';
import { CwlEditor } from './CwlEditor.js';

interface GraphemeSegment {
  readonly index: number;
}

interface GraphemeSegmenter {
  segment(input: string): Iterable<GraphemeSegment>;
}

interface GraphemeSegmenterConstructor {
  new (
    locales?: string | readonly string[],
    options?: { readonly granularity: 'grapheme' },
  ): GraphemeSegmenter;
}

afterEach(cleanup);

describe('CwlEditor text-position selector segmentation', () => {
  it('segments one captured projection only once for a non-collapsed selection', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Alpha beta" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());

    const handle = editorRef.current!;
    act(() => {
      handle.getEditor()!.commands.setTextSelection({ from: 2, to: 6 });
    });

    const intlWithSegmenter = Intl as typeof Intl & {
      Segmenter?: GraphemeSegmenterConstructor;
    };
    const OriginalSegmenter = intlWithSegmenter.Segmenter;
    if (typeof OriginalSegmenter !== 'function') {
      throw new Error('test runtime requires Intl.Segmenter');
    }
    const SegmenterConstructor: GraphemeSegmenterConstructor = OriginalSegmenter;

    let constructions = 0;
    let completedPasses = 0;

    class CountingSegmenter implements GraphemeSegmenter {
      readonly #delegate: GraphemeSegmenter;

      constructor(
        locales?: string | readonly string[],
        options?: { readonly granularity: 'grapheme' },
      ) {
        constructions += 1;
        this.#delegate = new SegmenterConstructor(locales, options);
      }

      segment(input: string): Iterable<GraphemeSegment> {
        const source = this.#delegate.segment(input);
        return {
          [Symbol.iterator](): Iterator<GraphemeSegment> {
            const iterator = source[Symbol.iterator]();
            let completed = false;
            return {
              next(): IteratorResult<GraphemeSegment> {
                const result = iterator.next();
                if (result.done && !completed) {
                  completed = true;
                  completedPasses += 1;
                }
                return result;
              },
            };
          },
        };
      }
    }

    try {
      Object.defineProperty(intlWithSegmenter, 'Segmenter', {
        configurable: true,
        value: CountingSegmenter,
      });

      const evidence = await handle.getTextPositionSelectorEvidence(undefined, {
        digest: async () => new Uint8Array(32).fill(0x55).buffer,
      });

      expect(evidence?.selector).toEqual({
        type: 'TextPositionSelector',
        start: 1,
        end: 5,
      });
      expect(completedPasses).toBe(1);
      expect(constructions).toBe(1);
    } finally {
      Object.defineProperty(intlWithSegmenter, 'Segmenter', {
        configurable: true,
        value: OriginalSegmenter,
      });
    }
  });
});
