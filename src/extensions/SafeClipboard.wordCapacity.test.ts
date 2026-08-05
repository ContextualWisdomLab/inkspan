import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CLIPBOARD_MAX_NODES,
  sanitizeRichClipboardHtml,
} from './SafeClipboard.js';

/** Build a deterministic large Word-like fragment with style-only emphasis. */
function representativeWordHtml(paragraphCount: number): string {
  return Array.from(
    { length: paragraphCount },
    (_, index) =>
      `<p class="MsoNormal"><span style="font-weight: bold">Word paragraph ${index + 1}</span></p>`,
  ).join('');
}

/** Count every element and text node traversed from one inert template. */
function traversedSourceNodeCount(sourceHtml: string): number {
  const template = document.createElement('template');
  template.innerHTML = sourceHtml;
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let count = 0;
  while (walker.nextNode() !== null) count += 1;
  return count;
}

describe('SafeClipboard representative Word capacity', () => {
  it('accepts a large Word-like fixture within the default node ceiling', () => {
    const sourceHtml = representativeWordHtml(3_000);
    const sourceNodes = traversedSourceNodeCount(sourceHtml);

    expect(sourceNodes).toBe(9_000);
    expect(sourceNodes).toBeLessThan(DEFAULT_CLIPBOARD_MAX_NODES);

    const sanitized = sanitizeRichClipboardHtml(sourceHtml, {}, document);
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(container.querySelectorAll('p')).toHaveLength(3_000);
    expect(container.querySelectorAll('strong')).toHaveLength(3_000);
    expect(container.firstElementChild).toHaveTextContent('Word paragraph 1');
    expect(container.lastElementChild).toHaveTextContent('Word paragraph 3000');
    expect(container.querySelector('[class], [style]')).toBeNull();
  });

  it('classifies one safe anchor href once and reuses that decision', () => {
    const originalGetAttribute = Element.prototype.getAttribute;
    const hrefReads = vi.fn();
    const getAttributeSpy = vi
      .spyOn(Element.prototype, 'getAttribute')
      .mockImplementation(function (this: Element, qualifiedName: string) {
        if (this.localName === 'a' && qualifiedName === 'href') hrefReads();
        return originalGetAttribute.call(this, qualifiedName);
      });

    try {
      const sanitized = sanitizeRichClipboardHtml(
        '<a href="https://example.com/path">safe</a>',
        {},
        document,
      );

      expect(sanitized).toContain('href="https://example.com/path"');
      expect(sanitized).toContain('rel="noopener noreferrer nofollow"');
      expect(hrefReads).toHaveBeenCalledTimes(1);
    } finally {
      getAttributeSpy.mockRestore();
    }
  });
});
