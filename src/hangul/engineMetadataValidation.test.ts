import {
  exportHangulDocument,
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

const EXPECTED_EXPORT_FAILURE = {
  code: 'ENGINE_OPERATION_FAILED',
  message: 'The Hangul engine failed during export.',
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

  it('rejects an excessive section count before traversing section data', async () => {
    const getParagraphCount = vi.fn(() => 0);
    const document = createDocument({
      getSectionCount: () => Number.MAX_SAFE_INTEGER,
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

  it('rejects an excessive paragraph count before asking for a terminal paragraph length', async () => {
    const getParagraphLength = vi.fn(() => 1);
    const document = createDocument({
      getParagraphCount: () => Number.MAX_SAFE_INTEGER,
      getParagraphLength,
    });

    await expect(
      openHangulDocument(new Uint8Array([1]), { engine: createEngine(document) }),
    ).rejects.toMatchObject(EXPECTED_IMPORT_FAILURE);
    expect(getParagraphLength).not.toHaveBeenCalled();
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

  it('rejects an excessive paragraph length before passing it to the host export boundary', async () => {
    const exportSelectionHtml = vi.fn(() => '<p>private</p>');
    const document = createDocument({
      getParagraphLength: () => Number.MAX_SAFE_INTEGER,
      exportSelectionHtml,
    });

    await expect(
      openHangulDocument(new Uint8Array([1]), { engine: createEngine(document) }),
    ).rejects.toMatchObject(EXPECTED_IMPORT_FAILURE);
    expect(exportSelectionHtml).not.toHaveBeenCalled();
  });

  it('reads the section count once so a stateful host cannot move the traversal bound', async () => {
    const getSectionCount = vi.fn(() => 1);
    const document = createDocument({ getSectionCount });

    const result = await openHangulDocument(new Uint8Array([1]), {
      engine: createEngine(document),
    });

    expect(result.documentJson).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    });
    expect(getSectionCount).toHaveBeenCalledTimes(1);
  });

  it('rejects a fractional export paragraph length before mutating the host document', async () => {
    const deleteText = vi.fn(() => '{"ok":true}');
    const pasteHtml = vi.fn(() => '{"ok":true}');
    const document = createDocument({
      getParagraphLength: () => 1.5,
      deleteText,
      pasteHtml,
    });

    await expect(
      exportHangulDocument(
        {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
        },
        { engine: createEngine(document) },
      ),
    ).rejects.toMatchObject(EXPECTED_EXPORT_FAILURE);
    expect(deleteText).not.toHaveBeenCalled();
    expect(pasteHtml).not.toHaveBeenCalled();
  });

  it('rejects an excessive export paragraph length before mutating the host document', async () => {
    const deleteText = vi.fn(() => '{"ok":true}');
    const pasteHtml = vi.fn(() => '{"ok":true}');
    const document = createDocument({
      getParagraphLength: () => Number.MAX_SAFE_INTEGER,
      deleteText,
      pasteHtml,
    });

    await expect(
      exportHangulDocument(
        {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
        },
        { engine: createEngine(document) },
      ),
    ).rejects.toMatchObject(EXPECTED_EXPORT_FAILURE);
    expect(deleteText).not.toHaveBeenCalled();
    expect(pasteHtml).not.toHaveBeenCalled();
  });
});