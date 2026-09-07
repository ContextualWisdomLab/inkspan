import { describe, expect, it, vi } from 'vitest';

import { sanitizeRichClipboardHtml } from './SafeClipboard.js';

describe('rich clipboard traversal budget', () => {
  it('reads the accepted source child list once while preserving order', () => {
    const originalGetter = Object.getOwnPropertyDescriptor(
      Node.prototype,
      'childNodes',
    )?.get;
    if (!originalGetter) throw new Error('The test DOM has no childNodes getter.');
    let fragmentListReads = 0;
    const childListSpy = vi.spyOn(Node.prototype, 'childNodes', 'get')
      .mockImplementation(function (this: Node) {
        const children = originalGetter.call(this);
        if (this.nodeType === Node.DOCUMENT_FRAGMENT_NODE && children.length === 3) {
          fragmentListReads += 1;
        }
        return children;
      });

    try {
      const sourceHtml = '<p>A</p><p>B</p><p>C</p>';
      expect(sanitizeRichClipboardHtml(sourceHtml, {}, document)).toBe(sourceHtml);
      expect(fragmentListReads).toBe(1);
    } finally {
      childListSpy.mockRestore();
    }
  });

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
          message:
            'The pasted content is too complex to insert. Try pasting less content at once.',
        }),
      );
      expect(broadChildReads).toBe(0);
    } finally {
      itemSpy.mockRestore();
    }
  });
});
