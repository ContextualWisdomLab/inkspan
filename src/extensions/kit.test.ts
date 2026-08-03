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
    // StarterKit + SafeLink + Placeholder + Table(+row/header/cell) + image.
    expect(names(exts)).toContain('image');
    expect(names(exts)).toContain('link');
    expect(names(exts)).toContain('table');
  });

  it('applies the strict shared hyperlink policy', () => {
    const exts = buildExtensions();
    const link = exts.find((extension) => extension.name === 'link');
    const isAllowedUri = link?.options.isAllowedUri as
      | ((href: string, context: unknown) => boolean)
      | undefined;
    expect(isAllowedUri).toBeTypeOf('function');
    expect(isAllowedUri?.('https://example.com', {})).toBe(true);
    expect(isAllowedUri?.('/relative/path', {})).toBe(true);
    expect(isAllowedUri?.('javascript:alert(1)', {})).toBe(false);
    expect(isAllowedUri?.('//attacker.example/path', {})).toBe(false);
    expect(link?.options.HTMLAttributes).toEqual({
      rel: 'noopener noreferrer nofollow',
    });
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

  it('forwards onImageError to Base64Image onError for paste/drop path', () => {
    const onImageError = () => {};
    const exts = buildExtensions({ onImageError });
    const image = exts.find((e) => e.name === 'image');
    expect(image?.options.onError).toBe(onImageError);
  });
});
