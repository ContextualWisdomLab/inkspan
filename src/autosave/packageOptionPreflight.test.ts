import { describe, expect, it } from 'vitest';
import { createDocumentAutosaveQueue } from './package.js';

describe('framework-free autosave option preflight', () => {
  it('rejects an invalid required save descriptor before key enumeration', () => {
    let ownKeysCalls = 0;
    const options = new Proxy(
      { save: 1 },
      {
        ownKeys() {
          ownKeysCalls += 1;
          throw new Error('private option keys');
        },
      },
    );

    expect(() => createDocumentAutosaveQueue(options as never)).toThrowError(
      expect.objectContaining({
        code: 'invalid_options',
        message: 'Document autosave queue options are invalid.',
      }),
    );
    expect(ownKeysCalls).toBe(0);
  });
});
