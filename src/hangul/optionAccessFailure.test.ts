import { describe, expect, it } from 'vitest';

import {
  exportHangulDocument,
  openHangulDocument,
  type ExportHangulDocumentOptions,
  type HangulDocumentEngine,
  type OpenHangulDocumentOptions,
} from './index.js';

const PRIVATE_OPTION_SENTINEL = new Error('private Hangul option sentinel');

function unusedEngine(onUse: () => void): HangulDocumentEngine {
  return {
    id: 'option-access-test',
    open: async () => {
      onUse();
      throw new Error('engine must not be reached');
    },
    create: async () => {
      onUse();
      throw new Error('engine must not be reached');
    },
  };
}

const PARAGRAPH_DOCUMENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'safe' }],
    },
  ],
};

function expectInvalidOptions(result: Promise<unknown>): Promise<void> {
  return expect(result).rejects.toMatchObject({
    code: 'INVALID_CONFIGURATION',
    message: 'Hangul options are invalid.',
  });
}

describe('Hangul public option access containment', () => {
  it('redacts a hostile maxSourceBytes accessor before engine open', async () => {
    let engineUseCount = 0;
    const options = {
      engine: unusedEngine(() => {
        engineUseCount += 1;
      }),
      get maxSourceBytes() {
        throw PRIVATE_OPTION_SENTINEL;
      },
    } as unknown as OpenHangulDocumentOptions;

    await expectInvalidOptions(openHangulDocument(new Uint8Array([1]), options));
    expect(engineUseCount).toBe(0);
  });

  it('redacts a hostile maxOutputBytes accessor before engine create', async () => {
    let engineUseCount = 0;
    const options = {
      engine: unusedEngine(() => {
        engineUseCount += 1;
      }),
      get maxOutputBytes() {
        throw PRIVATE_OPTION_SENTINEL;
      },
    } as unknown as ExportHangulDocumentOptions;

    await expectInvalidOptions(exportHangulDocument(PARAGRAPH_DOCUMENT, options));
    expect(engineUseCount).toBe(0);
  });

  it('redacts a hostile format accessor before engine create', async () => {
    let engineUseCount = 0;
    const options = {
      engine: unusedEngine(() => {
        engineUseCount += 1;
      }),
      get format() {
        throw PRIVATE_OPTION_SENTINEL;
      },
    } as unknown as ExportHangulDocumentOptions;

    await expectInvalidOptions(exportHangulDocument(PARAGRAPH_DOCUMENT, options));
    expect(engineUseCount).toBe(0);
  });
});
