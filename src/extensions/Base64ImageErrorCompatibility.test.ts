import { describe, expect, it } from 'vitest';
import { normalizeImageError } from './Base64Image.js';

describe('Base64Image Error compatibility', () => {
  it('fails closed when native Error metadata cannot be safely structured-cloned', () => {
    const rejection = new Error('actionable image failure');
    Object.defineProperty(rejection, 'cause', {
      configurable: true,
      value: () => undefined,
    });

    const normalized = normalizeImageError(rejection);

    expect(normalized).not.toBe(rejection);
    expect(normalized.message).toBe(
      "This image couldn't be inserted. Try a different image file.",
    );
  });
});
