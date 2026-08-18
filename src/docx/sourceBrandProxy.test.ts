import { describe, expect, it, vi } from 'vitest';

import { createDocx } from '../../test/docxFixture.js';
import { importDocx } from './index.js';

function createDocxBlob(): Blob {
  const fixture = createDocx();
  const bytes = new Uint8Array(fixture.byteLength);
  bytes.set(fixture);
  return new Blob([bytes.buffer]);
}

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

  it('does not execute post-load Blob size getter interposition', async () => {
    const source = createDocxBlob();
    const originalSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size');
    const hostileSize = vi.fn(() => {
      throw new Error('private Blob size sentinel');
    });

    Object.defineProperty(Blob.prototype, 'size', {
      configurable: true,
      get: hostileSize,
    });
    try {
      await expect(importDocx(source)).resolves.toMatchObject({
        documentJson: { type: 'doc' },
      });
      expect(hostileSize).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Blob.prototype, 'size', originalSize!);
    }
  });

  it('does not execute post-load Blob byte-reader interposition', async () => {
    const source = createDocxBlob();
    const originalArrayBuffer = Object.getOwnPropertyDescriptor(
      Blob.prototype,
      'arrayBuffer',
    );
    const hostileArrayBuffer = vi.fn(() => {
      throw new Error('private Blob arrayBuffer sentinel');
    });

    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      get: hostileArrayBuffer,
    });
    try {
      await expect(importDocx(source)).resolves.toMatchObject({
        documentJson: { type: 'doc' },
      });
      expect(hostileArrayBuffer).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Blob.prototype, 'arrayBuffer', originalArrayBuffer!);
    }
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
