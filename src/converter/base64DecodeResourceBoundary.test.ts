import { describe, expect, it, vi } from 'vitest';
import { Base64SizeError, dataUriToBytes } from './index.js';

describe('data URI decode resource boundary', () => {
  it('rejects oversized canonical base64 before decoder allocation', () => {
    const decoder = vi.spyOn(globalThis.Buffer, 'from');
    let failure: unknown;

    try {
      dataUriToBytes(
        `data:application/octet-stream;base64,${'AAAA'.repeat(4)}`,
        { maxBytes: 4 },
      );
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Base64SizeError);
    expect((failure as Base64SizeError).bytes).toBe(12);
    expect((failure as Base64SizeError).maxBytes).toBe(4);
    expect(decoder).not.toHaveBeenCalled();

    decoder.mockRestore();
  });
});
