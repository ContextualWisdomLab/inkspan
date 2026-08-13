import { describe, it, expect, afterEach, vi } from 'vitest';
import { toUint8Array, blobToDataUri } from './base64.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('toUint8Array with a non-Uint8Array view', () => {
  it('wraps an ArrayBufferView via buffer/offset/length', () => {
    const src = new Uint8Array([9, 8, 7, 6, 5]);
    // Int8Array is an ArrayBufferView but not a Uint8Array, so it exercises the
    // `ArrayBuffer.isView` branch rather than the fast identity return.
    const view = new Int8Array(src.buffer, 1, 3);
    const out = toUint8Array(view);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out)).toEqual([8, 7, 6]);
  });
});

// Note: the `btoa`/`atob` fallback in bytesToBase64/base64ToBytes only runs in
// a browser without a global `Buffer`. It cannot be exercised here without
// deleting `globalThis.Buffer`, which breaks vitest/jsdom/coverage internals,
// so that browser-only branch is annotated with `v8 ignore` in the source.

describe('readBlobBytes environment fallbacks', () => {
  const BYTES = new Uint8Array([1, 2, 3, 4]);
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const withoutArrayBuffer = (blob: Blob): Blob => {
    Object.defineProperty(blob, 'arrayBuffer', {
      configurable: true,
      value: undefined,
    });
    return blob;
  };

  it('uses Blob.arrayBuffer when the blob implements it', async () => {
    const blob = new Blob([BYTES], { type: 'application/octet-stream' });
    Object.defineProperty(blob, 'arrayBuffer', {
      configurable: true,
      value: () => Promise.resolve(BYTES.buffer.slice(0)),
    });
    const uri = await blobToDataUri(blob);
    expect(uri.startsWith('data:application/octet-stream;base64,')).toBe(true);
  });

  it('falls back to application/octet-stream for a typeless, unsniffable blob', async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2, 3])]);
    const uri = await blobToDataUri(blob);
    expect(uri.startsWith('data:application/octet-stream;base64,')).toBe(true);
  });

  it('rejects when FileReader errors and exposes its own error', async () => {
    class FailingReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      error: unknown = new Error('reader boom');
      result: ArrayBuffer | null = null;
      readAsArrayBuffer(): void {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('FileReader', FailingReader);
    // Shadow `arrayBuffer` on a genuine Blob so only the environment capability
    // changes; the runtime Blob-brand contract remains realistic.
    const blob = withoutArrayBuffer(new Blob([PNG], { type: 'image/png' }));
    await expect(blobToDataUri(blob)).rejects.toThrow('reader boom');
  });

  it('rejects with a synthesized error when FileReader has no error object', async () => {
    class NullErrorReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      error: unknown = null;
      result: ArrayBuffer | null = null;
      readAsArrayBuffer(): void {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('FileReader', NullErrorReader);
    const blob = withoutArrayBuffer(new Blob([PNG], { type: 'image/png' }));
    await expect(blobToDataUri(blob)).rejects.toThrow(
      /FileReader failed to read Blob/,
    );
  });

  it('reads through Response when neither arrayBuffer nor FileReader exist', async () => {
    vi.stubGlobal('FileReader', undefined);
    vi.stubGlobal(
      'Response',
      class FakeResponse {
        constructor(_blob: unknown) {}
        arrayBuffer(): Promise<ArrayBuffer> {
          return Promise.resolve(PNG.buffer.slice(0));
        }
      },
    );
    const blob = withoutArrayBuffer(new Blob([PNG], { type: 'image/png' }));
    const uri = await blobToDataUri(blob);
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
  });
});
