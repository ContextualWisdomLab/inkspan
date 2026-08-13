import type { JSONContent } from '@tiptap/core';
import * as hangulPackage from './package.js';
import {
  HangulDocumentError,
  exportHangulDocument,
  openHangulDocument,
  type HangulDocumentEngine,
  type HangulEngineDocument,
} from './index.js';

class BoundaryDocument implements HangulEngineDocument {
  freed = false;
  sourceFormat = 'hwp';
  output = new Uint8Array([1, 2]);
  failPaste = false;

  getSourceFormat(): string { return this.sourceFormat; }
  getSectionCount(): number { return 1; }
  getParagraphCount(): number { return 1; }
  getParagraphLength(): number { return 1; }
  exportSelectionHtml(): string { return '<p><em>I</em> <s>S</s></p>'; }
  deleteText(): string { return '{"ok":true}'; }
  pasteHtml(): string {
    if (this.failPaste) throw new Error('write failed');
    return '{"ok":true}';
  }
  exportHwp(): Uint8Array { return this.output; }
  exportHwpx(): Uint8Array { return this.output; }
  free(): void { this.freed = true; }
}

function engineFor(
  source: BoundaryDocument,
  target = new BoundaryDocument(),
): HangulDocumentEngine {
  return {
    id: 'boundary-engine',
    open: vi.fn(async () => source),
    create: vi.fn(async () => target),
  };
}

describe('Hangul bridge failure boundaries', () => {
  it('opens legacy HWP and preserves italic and strike marks', async () => {
    const result = await openHangulDocument(new Uint8Array([1]), {
      engine: engineFor(new BoundaryDocument()),
    });
    expect(result.sourceFormat).toBe('hwp');
    expect(result.documentJson.content?.[0]?.content).toEqual([
      { type: 'text', text: 'I', marks: [{ type: 'italic' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'S', marks: [{ type: 'strike' }] },
    ]);
  });

  it('preserves equivalent inline tags and transparent wrappers while ignoring comments', async () => {
    const source = new BoundaryDocument();
    source.sourceFormat = 'hwpx';
    vi.spyOn(source, 'exportSelectionHtml').mockReturnValue(
      '<p><b>B</b><i>I</i><strike>S</strike><span>U</span><!--ignored--></p>',
    );

    const result = await openHangulDocument(new Uint8Array([1]), {
      engine: engineFor(source),
      maxSourceBytes: 1,
    });

    expect(result.documentJson.content?.[0]?.content).toEqual([
      { type: 'text', text: 'B', marks: [{ type: 'bold' }] },
      { type: 'text', text: 'I', marks: [{ type: 'italic' }] },
      { type: 'text', text: 'S', marks: [{ type: 'strike' }] },
      { type: 'text', text: 'U' },
    ]);
  });

  it('ignores an empty text node returned by the parser', async () => {
    class EmptyTextDomParser {
      parseFromString(): {
        body: {
          children: Array<{
            tagName: string;
            childNodes: Array<{ nodeType: number; textContent: null }>;
          }>;
        };
      } {
        return {
          body: {
            children: [
              {
                tagName: 'P',
                childNodes: [{ nodeType: 3, textContent: null }],
              },
            ],
          },
        };
      }
    }

    vi.stubGlobal('DOMParser', EmptyTextDomParser);
    try {
      const result = await openHangulDocument(new Uint8Array([1]), {
        engine: engineFor(new BoundaryDocument()),
      });
      expect(result.documentJson.content?.[0]).toEqual({
        type: 'paragraph',
        content: [],
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('accepts an empty section without requiring a resource free hook', async () => {
    const source: HangulEngineDocument = {
      getSourceFormat: () => 'hwpx',
      getSectionCount: () => 1,
      getParagraphCount: () => 0,
      getParagraphLength: () => 0,
      exportSelectionHtml: () => '',
      deleteText: () => '{"ok":true}',
      pasteHtml: () => '{"ok":true}',
      exportHwp: () => new Uint8Array(),
      exportHwpx: () => new Uint8Array(),
    };
    const engine: HangulDocumentEngine = {
      id: 'empty-section',
      open: async () => source,
      create: async () => source,
    };

    const result = await openHangulDocument(new Uint8Array([1]), {
      engine,
      maxSourceBytes: 1,
    });
    expect(result.documentJson).toEqual({ type: 'doc', content: [] });
  });

  it('rejects source bytes above the configured bound before engine open', async () => {
    const source = new BoundaryDocument();
    const engine = engineFor(source);
    await expect(
      openHangulDocument(new Uint8Array([1, 2]), {
        engine,
        maxSourceBytes: 1,
      }),
    ).rejects.toMatchObject({ code: 'SOURCE_LIMIT_EXCEEDED' });
    expect(engine.open).not.toHaveBeenCalled();
  });

  it('rejects unknown source identities and frees opened resources', async () => {
    const source = new BoundaryDocument();
    source.sourceFormat = 'unknown';
    await expect(
      openHangulDocument(new Uint8Array([1]), {
        engine: engineFor(source),
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_SOURCE_FORMAT' });
    expect(source.freed).toBe(true);
  });

  it('normalizes engine open and create failures', async () => {
    const engine: HangulDocumentEngine = {
      id: 'failing-engine',
      open: async () => { throw new Error('open'); },
      create: async () => { throw new Error('create'); },
    };
    await expect(
      openHangulDocument(new Uint8Array([1]), { engine }),
    ).rejects.toMatchObject({ code: 'ENGINE_OPEN_FAILED' });
    await expect(
      exportHangulDocument({ type: 'doc' }, { engine }),
    ).rejects.toMatchObject({ code: 'ENGINE_CREATE_FAILED' });
  });

  it('exports legacy HWP and escapes markup-significant text', async () => {
    const target = new BoundaryDocument();
    const documentJson: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '<A>', marks: [{ type: 'bold' }] }],
        },
      ],
    };
    const result = await exportHangulDocument(documentJson, {
      engine: engineFor(new BoundaryDocument(), target),
      format: 'hwp',
    });
    expect(result.format).toBe('hwp');
    expect(Array.from(result.bytes)).toEqual([1, 2]);
  });

  it('renders empty text plus italic and strike marks without optional engine hooks', async () => {
    const target: HangulEngineDocument = {
      getSourceFormat: () => 'hwpx',
      getSectionCount: () => 1,
      getParagraphCount: () => 1,
      getParagraphLength: () => 0,
      exportSelectionHtml: () => '',
      deleteText: () => '{"ok":true}',
      pasteHtml: vi.fn(() => '{"ok":true}'),
      exportHwp: () => new Uint8Array([7]),
      exportHwpx: () => new Uint8Array([8]),
    };
    const engine: HangulDocumentEngine = {
      id: 'minimal-target',
      open: async () => target,
      create: async () => target,
    };
    const result = await exportHangulDocument(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', marks: [{ type: 'italic' }] },
              { type: 'text', text: 'S', marks: [{ type: 'strike' }] },
            ],
          },
        ],
      },
      { engine },
    );

    expect(result.format).toBe('hwpx');
    expect(Array.from(result.bytes)).toEqual([8]);
    expect(target.deleteText).toBeDefined();
    expect(target.pasteHtml).toHaveBeenCalledWith(
      0,
      0,
      0,
      '<p><em></em><s>S</s></p>',
    );
  });

  it('rejects unsupported nodes, marks, and every invalid heading shape', async () => {
    const engine = engineFor(new BoundaryDocument());
    await expect(
      exportHangulDocument({ type: 'paragraph' }, { engine }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_DOCUMENT_NODE' });
    await expect(
      exportHangulDocument(
        { type: 'doc', content: [{ type: 'video' }] },
        { engine },
      ),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_DOCUMENT_NODE' });
    await expect(
      exportHangulDocument(
        {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'x', marks: [{ type: 'highlight' }] },
              ],
            },
          ],
        },
        { engine },
      ),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_DOCUMENT_MARK' });
    await expect(
      exportHangulDocument(
        {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'hardBreak' }] },
          ],
        },
        { engine },
      ),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_DOCUMENT_NODE' });
    await expect(
      exportHangulDocument(
        {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'x', marks: [{}] },
              ],
            },
          ],
        } as unknown as JSONContent,
        { engine },
      ),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_DOCUMENT_MARK' });
    await expect(
      exportHangulDocument(
        { type: 'doc', content: [{}] } as unknown as JSONContent,
        { engine },
      ),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_DOCUMENT_NODE' });

    for (const attrs of [undefined, { level: 0 }, { level: 1.5 }, { level: 7 }]) {
      await expect(
        exportHangulDocument(
          { type: 'doc', content: [{ type: 'heading', ...(attrs ? { attrs } : {}) }] },
          { engine },
        ),
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_DOCUMENT_NODE' });
    }
  });

  it('normalizes engine write failures and output-bound violations', async () => {
    const writeTarget = new BoundaryDocument();
    writeTarget.failPaste = true;
    await expect(
      exportHangulDocument(
        { type: 'doc', content: [{ type: 'paragraph' }] },
        { engine: engineFor(new BoundaryDocument(), writeTarget) },
      ),
    ).rejects.toMatchObject({ code: 'ENGINE_OPERATION_FAILED' });
    expect(writeTarget.freed).toBe(true);

    const largeTarget = new BoundaryDocument();
    await expect(
      exportHangulDocument(
        { type: 'doc', content: [{ type: 'paragraph' }] },
        {
          engine: engineFor(new BoundaryDocument(), largeTarget),
          maxOutputBytes: 1,
        },
      ),
    ).rejects.toMatchObject({ code: 'OUTPUT_LIMIT_EXCEEDED' });
  });

  it('exposes the package surface and a stable error identity', () => {
    expect(hangulPackage.openHangulDocument).toBe(openHangulDocument);
    expect(hangulPackage.exportHangulDocument).toBe(exportHangulDocument);
    expect(hangulPackage.HangulDocumentError).toBe(HangulDocumentError);
    expect(typeof hangulPackage.createHangulModuleEngine).toBe('function');

    const error = new HangulDocumentError('TEST', 'message');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HangulDocumentError');
    expect(error.code).toBe('TEST');
  });
});
