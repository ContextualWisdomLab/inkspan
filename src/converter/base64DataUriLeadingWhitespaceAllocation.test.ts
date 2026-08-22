import { describe, expect, it } from 'vitest';
import { isDataUri, parseDataUri } from './index.js';

describe('data-URI leading-whitespace preflight', () => {
  it('accepts compatibility whitespace without allocating through trimStart', () => {
    const originalTrimStart = String.prototype.trimStart;
    let parsed: ReturnType<typeof parseDataUri> | undefined;
    let recognized = false;

    Object.defineProperty(String.prototype, 'trimStart', {
      configurable: true,
      writable: true,
      value() {
        throw new Error('trimStart must not materialize the caller-controlled URI');
      },
    });

    try {
      parsed = parseDataUri('\uFEFF \tdata:text/plain,hello ');
      recognized = isDataUri('\uFEFF \tdata:text/plain,hello ');
    } finally {
      Object.defineProperty(String.prototype, 'trimStart', {
        configurable: true,
        writable: true,
        value: originalTrimStart,
      });
    }

    expect(parsed).toEqual({
      mimeType: 'text/plain',
      isBase64: false,
      payload: 'hello ',
    });
    expect(recognized).toBe(true);
  });
});
