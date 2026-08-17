import {
  openHangulDocument,
  type HangulDocumentEngine,
  type HangulEngineDocument,
} from './index.js';

function createDocument(overrides: Partial<HangulEngineDocument>): HangulEngineDocument {
  return {
    getSourceFormat: () => 'hwpx',
    getSectionCount: () => 1,
    getParagraphCount: () => 1,
    getParagraphLength: () => 1,
    exportSelectionHtml: () => '<p>x</p>',
    deleteText: () => '{"ok":true}',
    pasteHtml: () => '{"ok":true}',
    exportHwp: () => new Uint8Array([1]),
    exportHwpx: () => new Uint8Array([1]),
    ...overrides,
  };
}

function createEngine(document: HangulEngineDocument): HangulDocumentEngine {
  return {
    id: 'metadata-validation',
    open: async () => document,
    create: async () => document,
  };
}

const EXPECTED_IMPORT_FAILURE = {
  code: 'ENGINE_OPERATION_FAILED',
  message: 'The Hangul engine failed during import.',
};

describe('Hangul engine structural metadata validation', () => {
  it('rejects a fractional section count before traversing section data', async () => {
    const getParagraphCount = vi.fn(() => 0);
    const document = createDocument({
      getSectionCount: () => 1.5,
      getParagraphCount,
    });

    await expect(
      openHangulDocument(new Uint8Array([1]), { engine: createEngine(document) }),
    ).rejects.toMatchObject(EXPECTED_IMPORT_FAILURE);
    expect(getParagraphCount).not.toHaveBeenCalled();
  });

  it('rejects a negative paragraph count before exporting section HTML', async () => {
    const exportSelectionHtml = vi.fn(() => '<p>private</p>');
    const document = createDocument({
      getParagraphCount: () => -1,
      exportSelectionHtml,
    });

    await expect(
      openHangulDocument(new Uint8Array([1]), { engine: createEngine(document) }),
    ).rejects.toMatchObject(EXPECTED_IMPORT_FAILURE);
    expect(exportSelectionHtml).not.toHaveBeenCalled();
  });

  it('rejects a fractional paragraph length before passing it to the host export boundary', async () => {
    const exportSelectionHtml = vi.fn(() => '<p>private</p>');
    const document = createDocument({
      getParagraphLength: () => 1.5,
      exportSelectionHtml,
    });

    await expect(
      openHangulDocument(new Uint8Array([1]), { engine: createEngine(document) }),
    ).rejects.toMatchObject(EXPECTED_IMPORT_FAILURE);
    expect(exportSelectionHtml).not.toHaveBeenCalled();
  });
});
