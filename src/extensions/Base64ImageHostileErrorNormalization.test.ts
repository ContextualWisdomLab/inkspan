import { describe, expect, it } from 'vitest';
import { normalizeImageError } from './Base64Image.js';

describe('Base64Image hostile error normalization', () => {
  it('does not inspect the prototype of an untrusted rejected value', () => {
    const privateSentinel = new Error('private image rejection sentinel');
    let prototypeReads = 0;
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          prototypeReads += 1;
          throw privateSentinel;
        },
      },
    );
    let normalized: Error | undefined;

    expect(() => {
      normalized = normalizeImageError(hostile);
    }).not.toThrow();
    expect(prototypeReads).toBe(0);
    expect(normalized).toBeInstanceOf(Error);
    expect(normalized?.message).toBe(
      "This image couldn't be inserted. Try a different image file.",
    );
    expect(normalized?.message).not.toContain(privateSentinel.message);
  });
});
