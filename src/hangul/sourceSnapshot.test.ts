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

function engineWithOpenCounter(counter: { calls: number }): HangulDocumentEngine {
  return {
    id: 'source-snapshot-test',
    open: async () => {
      counter.calls += 1;
      return emptyDocument();
    },
    create: async () => emptyDocument(),
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

  it('fails closed for forged typed-array proxies without executing caller traps', async () => {
    const privateSentinel = new Error('private proxy sentinel');
    let trapCalls = 0;
    const source = new Proxy(new Uint8Array([0x48]), {
      get() {
        trapCalls += 1;
        throw privateSentinel;
      },
    }) as Uint8Array;
    const counter = { calls: 0 };

    await expect(
      openHangulDocument(source, { engine: engineWithOpenCounter(counter) }),
    ).rejects.toMatchObject({
      name: 'HangulDocumentError',
      code: 'INVALID_SOURCE',
      message: 'Hangul source bytes are invalid.',
    });

    expect(trapCalls).toBe(0);
    expect(counter.calls).toBe(0);
  });

  it('fails closed for SharedArrayBuffer-backed views before the host engine observes mutable bytes', async () => {
    const source = new Uint8Array(new SharedArrayBuffer(4));
    const counter = { calls: 0 };

    await expect(
      openHangulDocument(source, { engine: engineWithOpenCounter(counter) }),
    ).rejects.toMatchObject({
      name: 'HangulDocumentError',
      code: 'INVALID_SOURCE',
      message: 'Hangul source bytes are invalid.',
    });

    expect(counter.calls).toBe(0);
  });
});
