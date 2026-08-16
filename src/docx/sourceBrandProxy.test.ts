import { describe, expect, it, vi } from 'vitest';

import { importDocx } from './index.js';

describe('DOCX binary source branding', () => {
  it('rejects hostile proxy sources without invoking prototype traps', async () => {
    const getPrototypeOf = vi.fn(() => {
      throw new Error('private prototype sentinel');
    });
    const hostileSource = new Proxy(Object.create(null) as object, {
      getPrototypeOf,
    });

    await expect(
      importDocx(hostileSource as unknown as ArrayBuffer),
    ).rejects.toMatchObject({
      name: 'DocxImportError',
      code: 'invalid_source',
      message: 'DOCX input must be a supported binary source.',
    });
    expect(getPrototypeOf).not.toHaveBeenCalled();
  });

  it('rejects hostile FileReader results without invoking prototype traps', async () => {
    const source = new Blob([new Uint8Array([1])]);
    Object.defineProperty(source, 'arrayBuffer', {
      configurable: true,
      value: undefined,
    });
    const getPrototypeOf = vi.fn(() => {
      throw new Error('private FileReader result sentinel');
    });
    const hostileResult = new Proxy(Object.create(null) as object, {
      getPrototypeOf,
    });
    const originalFileReader = globalThis.FileReader;

    class HostileResultReader {
      result: ArrayBuffer | string | null = hostileResult as unknown as ArrayBuffer;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsArrayBuffer(): void {
        this.onload?.();
      }
    }

    vi.stubGlobal('FileReader', HostileResultReader);
    try {
      await expect(importDocx(source)).rejects.toMatchObject({
        name: 'DocxImportError',
        code: 'invalid_source',
        message: 'DOCX input must be a supported binary source.',
      });
      expect(getPrototypeOf).not.toHaveBeenCalled();
    } finally {
      vi.stubGlobal('FileReader', originalFileReader);
    }
  });

  it('rejects unsupported sources when Blob is unavailable', async () => {
    vi.stubGlobal('Blob', undefined);
    try {
      await expect(
        importDocx(Object.create(null) as unknown as ArrayBuffer),
      ).rejects.toMatchObject({
        name: 'DocxImportError',
        code: 'invalid_source',
        message: 'DOCX input must be a supported binary source.',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
