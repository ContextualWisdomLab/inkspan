import {
  exportHangulDocument,
  type HangulDocumentEngine,
} from './index.js';

describe('Hangul export document JSON failure containment', () => {
  it('rejects hostile document access without leaking the thrown value or creating the engine', async () => {
    const privateSentinel = { secret: 'private-document-json-sentinel' };
    const create = vi.fn(async () => {
      throw new Error('engine create should not run');
    });
    const engine: HangulDocumentEngine = {
      id: 'hostile-document-json-sentinel',
      open: vi.fn(async () => {
        throw new Error('engine open should not run');
      }),
      create,
    };
    const documentJson = new Proxy(
      {},
      {
        get() {
          throw privateSentinel;
        },
      },
    ) as Parameters<typeof exportHangulDocument>[0];

    await expect(
      exportHangulDocument(documentJson, { engine }),
    ).rejects.toMatchObject({
      name: 'HangulDocumentError',
      code: 'INVALID_DOCUMENT',
      message: 'Hangul document JSON is invalid.',
    });
    expect(create).not.toHaveBeenCalled();
  });
});
