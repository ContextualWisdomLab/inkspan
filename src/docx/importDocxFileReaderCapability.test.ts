import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_BLOB_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(
  Blob.prototype,
  'arrayBuffer',
);

function restoreBlobArrayBuffer(): void {
  if (ORIGINAL_BLOB_ARRAY_BUFFER === undefined) {
    Reflect.deleteProperty(Blob.prototype, 'arrayBuffer');
    return;
  }
  Object.defineProperty(
    Blob.prototype,
    'arrayBuffer',
    ORIGINAL_BLOB_ARRAY_BUFFER,
  );
}

afterEach(() => {
  restoreBlobArrayBuffer();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('DOCX FileReader fallback capability isolation', () => {
  it('uses the FileReader capability captured when the fallback module initializes', async () => {
    const capturedBytes = new Uint8Array([0x50, 0x4b]).buffer;

    class TrustedFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: ArrayBuffer | null = null;

      readAsArrayBuffer(): void {
        this.result = capturedBytes.slice(0);
        queueMicrotask(() => this.onload?.());
      }
    }

    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    vi.stubGlobal('FileReader', TrustedFileReader);
    vi.resetModules();
    const { importDocx } = await import('./importDocx.js');

    let hostileConstructorCalls = 0;
    class HostileFileReader {
      constructor() {
        hostileConstructorCalls += 1;
        throw new Error('private fallback FileReader sentinel');
      }
    }
    vi.stubGlobal('FileReader', HostileFileReader);

    const source = new Blob([new Uint8Array([0x50, 0x4b])]);
    await expect(importDocx(source)).rejects.toMatchObject({
      code: 'invalid_zip',
    });
    expect(hostileConstructorCalls).toBe(0);
  });
});
