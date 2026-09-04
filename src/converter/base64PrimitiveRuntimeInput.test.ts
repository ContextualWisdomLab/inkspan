import { describe, expect, it } from 'vitest';

import { base64ToBytes } from './index.js';

const INVALID_BASE64_INPUT_MESSAGE = 'base64 input must be a string.';

describe('base64 primitive runtime input', () => {
  it('rejects a non-string before reading caller-controlled replace', () => {
    let replaceReads = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'replace', {
      configurable: true,
      enumerable: true,
      get() {
        replaceReads += 1;
        throw new Error('private replace getter must not execute');
      },
    });

    expect(() => base64ToBytes(hostile as unknown as string)).toThrowError(
      new TypeError(INVALID_BASE64_INPUT_MESSAGE),
    );
    expect(replaceReads).toBe(0);
  });

  it('rejects primitive non-strings with the same stable boundary error', () => {
    expect(() => base64ToBytes(123 as unknown as string)).toThrowError(
      new TypeError(INVALID_BASE64_INPUT_MESSAGE),
    );
  });
});
