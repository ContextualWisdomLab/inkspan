import type { JSONContent } from '@tiptap/core';
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

  it('rejects unsupported nodes, marks, and invalid headings', async () => {
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
        { type: 'doc', content: [{ type: 'heading', attrs: { level: 7 } }] },
        { engine },
      ),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_DOCUMENT_NODE' });
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

  it('exposes a stable error identity', () => {
    const error = new HangulDocumentError('TEST', 'message');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HangulDocumentError');
    expect(error.code).toBe('TEST');
  });
});
