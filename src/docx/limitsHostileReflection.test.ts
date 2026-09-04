import { describe, expect, it, vi } from 'vitest';
import { resolveDocxImportLimits } from './limits.js';
import type { DocxImportOptions } from './types.js';

describe('DOCX import limit failure containment', () => {
  it('does not inspect a hostile thrown value while redacting reflection failure', () => {
    const privateSentinel = new Error('private configuration sentinel');
    const thrownGetPrototypeOf = vi.fn(() => {
      throw privateSentinel;
    });
    const hostileThrownValue = new Proxy({}, { getPrototypeOf: thrownGetPrototypeOf });
    const options = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw hostileThrownValue;
        },
      },
    );

    let thrown: unknown;
    try {
      resolveDocxImportLimits(options as DocxImportOptions);
    } catch (error) {
      thrown = error;
    }

    expect(thrownGetPrototypeOf).not.toHaveBeenCalled();
    expect(thrown).toMatchObject({
      name: 'DocxImportError',
      code: 'invalid_configuration',
    });
  });
});
