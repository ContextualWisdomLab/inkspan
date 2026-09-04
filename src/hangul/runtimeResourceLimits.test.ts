import {
  exportHangulDocument,
  openHangulDocument,
  type HangulDocumentEngine,
} from './index.js';

function failingEngine(): HangulDocumentEngine {
  return {
    id: 'resource-limit-sentinel',
    open: vi.fn(async () => {
      throw new Error('engine open should not run');
    }),
    create: vi.fn(async () => {
      throw new Error('engine create should not run');
    }),
  };
}

const INVALID_BYTE_LIMITS = [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5];

describe('Hangul runtime byte-limit validation', () => {
  it.each(INVALID_BYTE_LIMITS)(
    'rejects invalid maxSourceBytes %s before opening the host engine',
    async (maxSourceBytes) => {
      const engine = failingEngine();

      await expect(
        openHangulDocument(new Uint8Array(), {
          engine,
          maxSourceBytes,
        }),
      ).rejects.toMatchObject({
        name: 'HangulDocumentError',
        code: 'INVALID_CONFIGURATION',
        message: 'Hangul byte limit configuration is invalid.',
      });
      expect(engine.open).not.toHaveBeenCalled();
    },
  );

  it.each(INVALID_BYTE_LIMITS)(
    'rejects invalid maxOutputBytes %s before inspecting document content or creating the host engine',
    async (maxOutputBytes) => {
      const engine = failingEngine();
      const documentJson = new Proxy(
        {},
        {
          get() {
            throw new Error('document should not be inspected');
          },
        },
      );

      await expect(
        exportHangulDocument(documentJson, {
          engine,
          maxOutputBytes,
        }),
      ).rejects.toMatchObject({
        name: 'HangulDocumentError',
        code: 'INVALID_CONFIGURATION',
        message: 'Hangul byte limit configuration is invalid.',
      });
      expect(engine.create).not.toHaveBeenCalled();
    },
  );
});
