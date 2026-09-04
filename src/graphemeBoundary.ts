/** Internal result of checking one UTF-16 code-unit offset against grapheme boundaries. */
export type GraphemeBoundaryState = 'boundary' | 'inside_grapheme' | 'unavailable';

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

/**
 * Classify one UTF-16 code-unit offset using the runtime's Unicode grapheme segmenter.
 *
 * Callers retain authority over their public error type. Any unavailable,
 * replaced, or throwing runtime segmenter produces one stable unsupported state
 * instead of leaking host exceptions across the selector boundary.
 */
export function classifyGraphemeBoundary(
  text: string,
  codeUnitOffset: number,
): GraphemeBoundaryState {
  try {
    const Segmenter = (
      Intl as unknown as { Segmenter?: GraphemeSegmenterConstructor }
    ).Segmenter;
    if (typeof Segmenter !== 'function') {
      return 'unavailable';
    }

    if (codeUnitOffset === 0 || codeUnitOffset === text.length) {
      return 'boundary';
    }
    for (const segment of new Segmenter(undefined, {
      granularity: 'grapheme',
    }).segment(text)) {
      if (segment.index === codeUnitOffset) {
        return 'boundary';
      }
    }
    return 'inside_grapheme';
  } catch {
    return 'unavailable';
  }
}
