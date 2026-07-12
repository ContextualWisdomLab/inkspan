import { describe, it, expect } from 'vitest';
import { buildExtensions } from './kit.js';

/** Names present in every kit regardless of options. */
function names(exts: ReturnType<typeof buildExtensions>): string[] {
  return exts.map((e) => e.name);
}

describe('buildExtensions', () => {
  it('builds the default set when called with no options', () => {
    const exts = buildExtensions();
    expect(Array.isArray(exts)).toBe(true);
    // StarterKit + Link + Placeholder + Table(+row/header/cell) + image.
    expect(names(exts)).toContain('image');
    expect(names(exts)).toContain('link');
    expect(names(exts)).toContain('table');
  });

  it('applies image defaults when the image config is an empty object', () => {
    const exts = buildExtensions({ image: {} });
    const image = exts.find((e) => e.name === 'image');
    expect(image?.options.maxSizeBytes).toBe(10 * 1024 * 1024);
    expect(image?.options.maxDimension).toBe(1600);
    expect(image?.options.quality).toBe(0.85);
  });

  it('honors an explicit image config and placeholder', () => {
    const exts = buildExtensions({
      placeholder: 'Type here…',
      image: { maxSizeBytes: 123, maxDimension: 42, quality: 0.5 },
    });
    const image = exts.find((e) => e.name === 'image');
    expect(image?.options.maxSizeBytes).toBe(123);
    expect(image?.options.maxDimension).toBe(42);
    expect(image?.options.quality).toBe(0.5);
    const placeholder = exts.find((e) => e.name === 'placeholder');
    expect(placeholder?.options.placeholder).toBe('Type here…');
  });
});
