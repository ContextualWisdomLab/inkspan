import {
  HangulDocumentError,
  openHangulDocument,
  type HangulDocumentEngine,
  type HangulEngineDocument,
} from './index.js';

describe('Hangul import engine-operation boundary', () => {
  it('contains hostile host-engine operation throws without reflecting them', async () => {
    let prototypeReads = 0;
    const hostile = new Proxy(Object.create(null) as object, {
      getPrototypeOf() {
        prototypeReads += 1;
        throw new Error('private-import-prototype-sentinel');
      },
    });
    let freed = false;
    const document: HangulEngineDocument = {
      getSourceFormat: () => {
        throw hostile;
      },
      getSectionCount: () => 0,
      getParagraphCount: () => 0,
      getParagraphLength: () => 0,
      exportSelectionHtml: () => '',
      deleteText: () => '',
      pasteHtml: () => '',
      exportHwp: () => new Uint8Array(),
      exportHwpx: () => new Uint8Array(),
      free: () => {
        freed = true;
      },
    };
    const engine: HangulDocumentEngine = {
      id: 'hostile-import-operation-test',
      open: async () => document,
      create: async () => document,
    };

    let caught: unknown;
    try {
      await openHangulDocument(new Uint8Array([0x48]), { engine });
    } catch (error) {
      caught = error;
    }

    expect(caught).not.toBe(hostile);
    expect(caught).toBeInstanceOf(HangulDocumentError);
    expect(caught).toMatchObject({
      name: 'HangulDocumentError',
      code: 'ENGINE_OPERATION_FAILED',
      message: 'The Hangul engine failed during import.',
    });
    expect(prototypeReads).toBe(0);
    expect(freed).toBe(true);
  });

  it('rejects a non-string source format before caller member access', async () => {
    let memberReads = 0;
    const hostileFormat = new Proxy(Object.create(null) as object, {
      get() {
        memberReads += 1;
        throw new Error('private-source-format-member-sentinel');
      },
    });
    const document: HangulEngineDocument = {
      getSourceFormat: () => hostileFormat as unknown as string,
      getSectionCount: () => 0,
      getParagraphCount: () => 0,
      getParagraphLength: () => 0,
      exportSelectionHtml: () => '',
      deleteText: () => '',
      pasteHtml: () => '',
      exportHwp: () => new Uint8Array(),
      exportHwpx: () => new Uint8Array(),
    };
    const engine: HangulDocumentEngine = {
      id: 'non-string-source-format-test',
      open: async () => document,
      create: async () => document,
    };

    await expect(
      openHangulDocument(new Uint8Array([0x48]), { engine }),
    ).rejects.toMatchObject({
      name: 'HangulDocumentError',
      code: 'ENGINE_OPERATION_FAILED',
      message: 'The Hangul engine failed during import.',
    });
    expect(memberReads).toBe(0);
  });

  it('rejects non-string selection HTML before caller coercion', async () => {
    let coercionReads = 0;
    const hostileHtml = new Proxy(Object.create(null) as object, {
      get() {
        coercionReads += 1;
        throw new Error('private-selection-html-coercion-sentinel');
      },
    });
    const document: HangulEngineDocument = {
      getSourceFormat: () => 'hwpx',
      getSectionCount: () => 1,
      getParagraphCount: () => 1,
      getParagraphLength: () => 0,
      exportSelectionHtml: () => hostileHtml as unknown as string,
      deleteText: () => '',
      pasteHtml: () => '',
      exportHwp: () => new Uint8Array(),
      exportHwpx: () => new Uint8Array(),
    };
    const engine: HangulDocumentEngine = {
      id: 'non-string-selection-html-test',
      open: async () => document,
      create: async () => document,
    };

    await expect(
      openHangulDocument(new Uint8Array([0x48]), { engine }),
    ).rejects.toMatchObject({
      name: 'HangulDocumentError',
      code: 'ENGINE_OPERATION_FAILED',
      message: 'The Hangul engine failed during import.',
    });
    expect(coercionReads).toBe(0);
  });
});
