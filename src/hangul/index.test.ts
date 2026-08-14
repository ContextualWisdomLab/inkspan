import type { JSONContent } from '@tiptap/core';
import {
  exportHangulDocument,
  openHangulDocument,
  type HangulDocumentEngine,
  type HangulEngineDocument,
} from './index.js';

class FakeDocument implements HangulEngineDocument {
  freed = false;
  readonly calls: string[] = [];
  sourceFormat = 'hwpx';
  selectionHtml = '<h1>Title</h1><p><strong>Body</strong></p>';

  getSourceFormat(): string {
    return this.sourceFormat;
  }

  getSectionCount(): number {
    return 1;
  }

  getParagraphCount(): number {
    return 1;
  }

  getParagraphLength(): number {
    return 5;
  }

  exportSelectionHtml(): string {
    return this.selectionHtml;
  }

  getValidationWarnings(): string {
    return '{"warnings":[]}';
  }

  createBlankDocument(): string {
    this.calls.push('createBlankDocument');
    return '{"ok":true}';
  }

  beginBatch(): string {
    this.calls.push('beginBatch');
    return '{"ok":true}';
  }

  endBatch(): string {
    this.calls.push('endBatch');
    return '{"ok":true}';
  }

  deleteText(
    sectionIndex: number,
    paragraphIndex: number,
    charOffset: number,
    count: number,
  ): string {
    this.calls.push(
      `deleteText:${sectionIndex}:${paragraphIndex}:${charOffset}:${count}`,
    );
    return '{"ok":true}';
  }

  pasteHtml(
    sectionIndex: number,
    paragraphIndex: number,
    charOffset: number,
    html: string,
  ): string {
    this.calls.push(
      `pasteHtml:${sectionIndex}:${paragraphIndex}:${charOffset}:${html}`,
    );
    return '{"ok":true}';
  }

  exportHwp(): Uint8Array {
    this.calls.push('exportHwp');
    return new Uint8Array([1, 2, 3]);
  }

  exportHwpx(): Uint8Array {
    this.calls.push('exportHwpx');
    return new Uint8Array([4, 5, 6]);
  }

  free(): void {
    this.freed = true;
  }
}

function createEngine(
  source: FakeDocument,
  target = new FakeDocument(),
): HangulDocumentEngine {
  return {
    id: 'fake',
    open: vi.fn(async () => source),
    create: vi.fn(async () => target),
  };
}

describe('Hangul document bridge', () => {
  it('opens HWPX as editable TipTap JSON', async () => {
    const source = new FakeDocument();
    const result = await openHangulDocument(new Uint8Array([9]), {
      engine: createEngine(source),
    });

    expect(result.sourceFormat).toBe('hwpx');
    expect(result.documentJson).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Title' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Body', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    });
    expect(result.lossy).toBe(false);
    expect(source.freed).toBe(true);
  });

  it('rejects unsupported imported blocks without reflecting document content', async () => {
    const source = new FakeDocument();
    source.selectionHtml =
      '<aside data-private="tenant-secret">sensitive body</aside>';
    let caught: unknown;

    try {
      await openHangulDocument(new Uint8Array([9]), {
        engine: createEngine(source),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      code: 'UNSUPPORTED_DOCUMENT_NODE',
      message: 'Hangul import contains an unsupported block node.',
    });
    expect((caught as Error).message).not.toContain('aside');
    expect((caught as Error).message).not.toContain('tenant-secret');
    expect((caught as Error).message).not.toContain('sensitive body');
    expect(source.freed).toBe(true);
  });

  it('preserves aligned paragraphs, lists, quotes, code blocks, and basic tables', async () => {
    const source = new FakeDocument();
    source.selectionHtml = [
      '<p style="text-align: center">Centered</p>',
      '<ul><li><p>Bullet</p></li></ul>',
      '<ol><li><p><em>Numbered</em></p></li></ol>',
      '<blockquote><p>Quote</p></blockquote>',
      '<pre><code>let x = 1 &lt; 2;</code></pre>',
      '<table><thead><tr><th>Head</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>',
    ].join('');

    const result = await openHangulDocument(new Uint8Array([9]), {
      engine: createEngine(source),
    });

    const expected: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [{ type: 'text', text: 'Centered' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Bullet' }],
                },
              ],
            },
          ],
        },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Numbered',
                      marks: [{ type: 'italic' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Quote' }],
            },
          ],
        },
        {
          type: 'codeBlock',
          content: [{ type: 'text', text: 'let x = 1 < 2;' }],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Head' }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Cell' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(result.documentJson).toEqual(expected);

    const target = new FakeDocument();
    await exportHangulDocument(expected, {
      engine: createEngine(source, target),
    });
    const pasted = target.calls.find((call) => call.startsWith('pasteHtml:'));
    expect(pasted).toContain('<p style="text-align: center">Centered</p>');
    expect(pasted).toContain('<ul><li><p>Bullet</p></li></ul>');
    expect(pasted).toContain('<ol><li><p><em>Numbered</em></p></li></ol>');
    expect(pasted).toContain('<blockquote><p>Quote</p></blockquote>');
    expect(pasted).toContain('<pre><code>let x = 1 &lt; 2;</code></pre>');
    expect(pasted).toContain(
      '<table><tr><th><p>Head</p></th></tr><tr><td><p>Cell</p></td></tr></table>',
    );
  });

  it('exports edited JSON as HWPX by default', async () => {
    const source = new FakeDocument();
    const target = new FakeDocument();
    const documentJson: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'A&B' }],
        },
      ],
    };

    const result = await exportHangulDocument(documentJson, {
      engine: createEngine(source, target),
    });

    expect(result.format).toBe('hwpx');
    expect(Array.from(result.bytes)).toEqual([4, 5, 6]);
    expect(target.calls).toContain('createBlankDocument');
    expect(target.calls.join('\n')).toContain('<p>A&amp;B</p>');
    expect(target.calls).toContain('exportHwpx');
    expect(target.freed).toBe(true);
  });
});
