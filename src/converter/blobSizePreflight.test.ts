import { describe, expect, it, vi } from 'vitest';

import { Base64SizeError, blobToDataUri } from './index.js';

describe('Blob conversion resource preflight', () => {
  it('rejects a known oversized Blob before reading its payload bytes', async () => {
    const blob = new Blob([new Uint8Array(32)], { type: 'application/octet-stream' });
    const read = vi.fn(async () => new Uint8Array(32).buffer);
    Object.defineProperty(blob, 'arrayBuffer', {
      configurable: true,
      value: read,
    });

    await expect(blobToDataUri(blob, { maxBytes: 4 })).rejects.toMatchObject({
      name: 'Base64SizeError',
      bytes: 32,
      maxBytes: 4,
    } satisfies Partial<Base64SizeError>);
    expect(read).not.toHaveBeenCalled();
  });
});
