import { afterEach, describe, expect, it, vi } from 'vitest';
import { htmlToMarkdown } from './serializer.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HTML-to-Markdown DOM allocation', () => {
  it('sanitizes accepted HTML without copying the complete element NodeList', () => {
    const arrayFrom = vi.spyOn(Array, 'from');

    expect(
      htmlToMarkdown('<p>Alpha <strong>Beta</strong></p>', {
        maxHtmlBytes: 1024,
      }),
    ).toBe('Alpha **Beta**');

    const copiedElementNodeList = arrayFrom.mock.calls.some(([value]) =>
      Object.prototype.toString.call(value) === '[object NodeList]',
    );
    expect(copiedElementNodeList).toBe(false);
  });
});
