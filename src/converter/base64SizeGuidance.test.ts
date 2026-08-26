import { describe, expect, it } from 'vitest';
import { Base64SizeError, bytesToDataUri } from './index.js';

describe('Base64 size guidance', () => {
  it('states the inclusive maxBytes boundary in exact human units', () => {
    expect(() =>
      bytesToDataUri(new Uint8Array(4), { maxBytes: 4 }),
    ).not.toThrow();

    expect(new Base64SizeError(5, 4).message).toContain(
      'at or below 4 bytes',
    );
    expect(new Base64SizeError(2049, 2048).message).toContain(
      'at or below 2 KB',
    );
    expect(new Base64SizeError(3 * 1024 * 1024 + 1, 3 * 1024 * 1024).message).toContain(
      'at or below 3 MB',
    );
    expect(new Base64SizeError(1501, 1500).message).toContain(
      'at or below 1500 bytes',
    );
  });
});
