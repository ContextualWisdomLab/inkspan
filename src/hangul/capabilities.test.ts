import {
  openHangulDocument,
  type HangulDocumentEngine,
  type HangulEngineDocument,
} from './index.js';

class CapabilityDocument implements HangulEngineDocument {
  getSourceFormat(): string {
    return 'hwpx';
  }

  getSectionCount(): number {
    return 1;
  }

  getParagraphCount(): number {
    return 1;
  }

  getParagraphLength(): number {
    return 4;
  }

  exportSelectionHtml(): string {
    return '<p>Body</p>';
  }

  deleteText(): string {
    return '{"ok":true}';
  }

  pasteHtml(): string {
    return '{"ok":true}';
  }

  exportHwp(): Uint8Array {
    return new Uint8Array([1]);
  }

  exportHwpx(): Uint8Array {
    return new Uint8Array([2]);
  }
}

function createEngine(): HangulDocumentEngine {
  return {
    id: 'capability-test',
    open: async () => new CapabilityDocument(),
    create: async () => new CapabilityDocument(),
  };
}

describe('Hangul public capability contract', () => {
  it('returns the deterministic bridge capabilities required by the public import contract', async () => {
    const result = await openHangulDocument(new Uint8Array([9]), {
      engine: createEngine(),
    });

    expect(result.capabilities).toEqual({
      importFormats: ['hwp', 'hwpx'],
      exportFormats: ['hwpx', 'hwp'],
      recommendedExportFormat: 'hwpx',
      supportedContent: [
        'paragraph',
        'heading',
        'bold',
        'italic',
        'strike',
        'bulletList',
        'orderedList',
        'blockquote',
        'codeBlock',
        'table',
      ],
    });
    expect(Object.isFrozen(result.capabilities)).toBe(true);
    expect(Object.isFrozen(result.capabilities.importFormats)).toBe(true);
    expect(Object.isFrozen(result.capabilities.exportFormats)).toBe(true);
    expect(Object.isFrozen(result.capabilities.supportedContent)).toBe(true);
  });
});
