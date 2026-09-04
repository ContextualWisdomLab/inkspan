import { describe, expect, it, vi } from 'vitest';

import {
  exportHangulDocument,
  type HangulDocumentEngine,
  type HangulEngineDocument,
} from './index.js';

describe('Hangul runtime export format validation', () => {
  it('rejects an invalid runtime format before creating an engine document', async () => {
    const engineDocument = {} as HangulEngineDocument;
    const engine: HangulDocumentEngine = {
      id: 'runtime-format-boundary',
      open: vi.fn(async () => engineDocument),
      create: vi.fn(async () => engineDocument),
    };

    await expect(
      exportHangulDocument(
        { type: 'doc' },
        {
          engine,
          format: 'doc' as unknown as 'hwp',
        },
      ),
    ).rejects.toMatchObject({
      name: 'HangulDocumentError',
      code: 'INVALID_CONFIGURATION',
      message: 'Hangul export format is invalid.',
    });

    expect(engine.create).not.toHaveBeenCalled();
  });
});
