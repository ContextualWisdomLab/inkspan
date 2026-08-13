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
    return '<h1>Title</h1><p><strong>Body</strong></p>';
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
