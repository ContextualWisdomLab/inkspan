import { describe, expect, it } from 'vitest';
import { normalizeImageError } from './Base64Image.js';

describe('Base64Image Error compatibility', () => {
  it('preserves a genuine Error even when its cause is not structured-cloneable', () => {
    const rejection = new Error('actionable image failure');
    Object.defineProperty(rejection, 'cause', {
      configurable: true,
      value: () => undefined,
    });

    expect(normalizeImageError(rejection)).toBe(rejection);
  });
});
