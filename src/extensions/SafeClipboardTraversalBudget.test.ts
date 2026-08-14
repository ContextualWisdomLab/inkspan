import { describe, expect, it, vi } from 'vitest';

import { sanitizeRichClipboardHtml } from './SafeClipboard.js';

describe('rich clipboard traversal budget', () => {
  it('rejects a broad source before materializing children beyond maxNodes', () => {
    const originalItem = NodeList.prototype.item;
    let broadChildReads = 0;
    const itemSpy = vi
      .spyOn(NodeList.prototype, 'item')
      .mockImplementation(function (this: NodeList, index: number) {
        if (this.length === 3) broadChildReads += 1;
        return originalItem.call(this, index);
      });

    try {
      expect(() =>
        sanitizeRichClipboardHtml(
          '<p>A</p><p>B</p><p>C</p>',
          { maxNodes: 2 },
          document,
        ),
      ).toThrowError(
        expect.objectContaining({
          code: 'node_limit_exceeded',
          message: 'Rich clipboard HTML exceeds the configured node limit.',
        }),
      );
      expect(broadChildReads).toBe(0);
    } finally {
      itemSpy.mockRestore();
    }
  });
});
