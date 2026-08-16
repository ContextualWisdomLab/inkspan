import {
  openHangulDocument,
  type HangulDocumentEngine,
  type HangulEngineDocument,
} from './index.js';

function emptyDocument(): HangulEngineDocument {
  return {
    getSourceFormat: () => 'hwp',
    getSectionCount: () => 0,
    getParagraphCount: () => 0,
    getParagraphLength: () => 0,
    exportSelectionHtml: () => '',
    deleteText: () => '',
    pasteHtml: () => '',
    exportHwp: () => new Uint8Array(),
    exportHwpx: () => new Uint8Array(),
  };
}

describe('Hangul source snapshot boundary', () => {
  it('does not execute caller-owned byteLength accessors and passes a detached byte snapshot to the host engine', async () => {
    const privateSentinel = new Error('private byteLength sentinel');
    const source = new Uint8Array([0x48, 0x57, 0x50]);
    let byteLengthAccessorCalls = 0;
    Object.defineProperty(source, 'byteLength', {
      configurable: true,
      get() {
        byteLengthAccessorCalls += 1;
        throw privateSentinel;
      },
    });

    let receivedSource: Uint8Array | null = null;
    const engine: HangulDocumentEngine = {
      id: 'source-snapshot-test',
      open: async (bytes) => {
        receivedSource = bytes;
        return emptyDocument();
      },
      create: async () => emptyDocument(),
    };

    await expect(openHangulDocument(source, { engine })).resolves.toMatchObject({
      sourceFormat: 'hwp',
      lossy: false,
    });

    expect(byteLengthAccessorCalls).toBe(0);
    expect(receivedSource).not.toBe(source);
    expect(Array.from(receivedSource ?? [])).toEqual([0x48, 0x57, 0x50]);
  });
});
