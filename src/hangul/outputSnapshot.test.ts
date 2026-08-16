import {
  exportHangulDocument,
  type HangulDocumentEngine,
  type HangulEngineDocument,
} from './index.js';

const DOCUMENT = { type: 'doc', content: [{ type: 'paragraph' }] } as const;

function documentWithOutput(output: Uint8Array): HangulEngineDocument {
  return {
    getSourceFormat: () => 'hwpx',
    getSectionCount: () => 0,
    getParagraphCount: () => 0,
    getParagraphLength: () => 0,
    exportSelectionHtml: () => '',
    deleteText: () => '',
    pasteHtml: () => '',
    exportHwp: () => output,
    exportHwpx: () => output,
  };
}

function engineWithOutput(output: Uint8Array): HangulDocumentEngine {
  return {
    id: 'output-snapshot-test',
    open: async () => documentWithOutput(output),
    create: async () => documentWithOutput(output),
  };
}

describe('Hangul output snapshot boundary', () => {
  it('does not execute caller-owned byteLength accessors and returns an Inkspan-owned byte snapshot', async () => {
    const privateSentinel = new Error('private output byteLength sentinel');
    const output = new Uint8Array([0x48, 0x57, 0x50, 0x58]);
    let byteLengthAccessorCalls = 0;
    Object.defineProperty(output, 'byteLength', {
      configurable: true,
      get() {
        byteLengthAccessorCalls += 1;
        throw privateSentinel;
      },
    });

    const result = await exportHangulDocument(DOCUMENT, {
      engine: engineWithOutput(output),
    });

    expect(byteLengthAccessorCalls).toBe(0);
    expect(result.format).toBe('hwpx');
    expect(result.bytes).not.toBe(output);
    expect(Array.from(result.bytes)).toEqual([0x48, 0x57, 0x50, 0x58]);
  });

  it('fails closed for forged typed-array proxies without executing caller traps', async () => {
    const privateSentinel = new Error('private output proxy sentinel');
    let trapCalls = 0;
    const output = new Proxy(new Uint8Array([0x48]), {
      get() {
        trapCalls += 1;
        throw privateSentinel;
      },
    }) as Uint8Array;

    await expect(
      exportHangulDocument(DOCUMENT, { engine: engineWithOutput(output) }),
    ).rejects.toMatchObject({
      name: 'HangulDocumentError',
      code: 'ENGINE_OPERATION_FAILED',
      message: 'The Hangul engine failed during export.',
    });

    expect(trapCalls).toBe(0);
  });

  it('fails closed for SharedArrayBuffer-backed engine output before returning mutable bytes', async () => {
    const output = new Uint8Array(new SharedArrayBuffer(4));

    await expect(
      exportHangulDocument(DOCUMENT, { engine: engineWithOutput(output) }),
    ).rejects.toMatchObject({
      name: 'HangulDocumentError',
      code: 'ENGINE_OPERATION_FAILED',
      message: 'The Hangul engine failed during export.',
    });
  });
});
