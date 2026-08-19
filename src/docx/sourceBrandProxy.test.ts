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

  it('does not consult replaced ArrayBuffer.isView after platform capture', async () => {
    const source = createDocx();
    const hostileIsView = vi
      .spyOn(ArrayBuffer, 'isView')
      .mockImplementation(() => {
        throw new Error('private ArrayBuffer.isView sentinel');
      });

    try {
      await expect(importDocx(source)).resolves.toMatchObject({
        documentJson: { type: 'doc' },
      });
      expect(hostileIsView).not.toHaveBeenCalled();
    } finally {
      hostileIsView.mockRestore();
    }
  });

  it('does not consult a replaced global TextDecoder after platform capture', async () => {
    const source = createDocx();
    const hostileConstructor = vi.fn();

    class HostileTextDecoder {
      constructor() {
        hostileConstructor();
        throw new Error('private TextDecoder sentinel');
      }
    }

    vi.stubGlobal('TextDecoder', HostileTextDecoder);
    try {
      await expect(importDocx(source)).resolves.toMatchObject({
        documentJson: { type: 'doc' },
      });
      expect(hostileConstructor).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
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
      if (originalArrayBuffer === undefined) {
        Reflect.deleteProperty(Blob.prototype, 'arrayBuffer');
      } else {
        Object.defineProperty(
          Blob.prototype,
          'arrayBuffer',
          originalArrayBuffer,
        );
      }
    }
  });

  it('does not execute a replaced Blob byte-reader value after platform capture', async () => {
    const source = createDocxBlob();
    const originalArrayBuffer = Object.getOwnPropertyDescriptor(
      Blob.prototype,
      'arrayBuffer',
    );
    const hostileArrayBuffer = vi.fn(() => {
      throw new Error('private Blob arrayBuffer value sentinel');
    });

    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      writable: true,
      value: hostileArrayBuffer,
    });
    try {
      await expect(importDocx(source)).resolves.toMatchObject({
        documentJson: { type: 'doc' },
      });
      expect(hostileArrayBuffer).not.toHaveBeenCalled();
    } finally {
      if (originalArrayBuffer === undefined) {
        Reflect.deleteProperty(Blob.prototype, 'arrayBuffer');
      } else {
        Object.defineProperty(
          Blob.prototype,
          'arrayBuffer',
          originalArrayBuffer,
        );
      }
    }
  });

  it('does not consult a replaced global Blob after platform capture', async () => {
    const source = createDocxBlob();
    const originalBlob = globalThis.Blob;
    const get = vi.fn((_target: typeof Blob, property: PropertyKey) => {
      if (property === 'prototype') {
        throw new Error('private global Blob sentinel');
      }
      return Reflect.get(originalBlob, property);
    });

    vi.stubGlobal('Blob', new Proxy(originalBlob, { get }));
    try {
      await expect(importDocx(source)).resolves.toMatchObject({
        documentJson: { type: 'doc' },
      });
      expect(get).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fails closed when Blob support was absent at module initialization', async () => {
    const originalBlob = globalThis.Blob;
    vi.resetModules();
    vi.stubGlobal('Blob', undefined);
    const { importDocx: importWithoutBlob } = await import('./importDocx.js');
    vi.stubGlobal('Blob', originalBlob);
    try {
      await expect(importWithoutBlob(createDocxBlob())).rejects.toMatchObject({
        name: 'DocxImportError',
        code: 'invalid_source',
        message: 'DOCX input must be a supported binary source.',
      });
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it('rejects hostile FileReader results without invoking prototype traps', async () => {
    const originalArrayBuffer = Object.getOwnPropertyDescriptor(
      Blob.prototype,
      'arrayBuffer',
    );
    const getPrototypeOf = vi.fn(() => {
      throw new Error('private FileReader result sentinel');
    });
    const hostileResult = new Proxy(Object.create(null) as object, {
      getPrototypeOf,
    });

    class HostileResultReader {
      result: ArrayBuffer | string | null = hostileResult as unknown as ArrayBuffer;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsArrayBuffer(): void {
        this.onload?.();
      }
    }

    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    vi.stubGlobal('FileReader', HostileResultReader);
    vi.resetModules();
    const { importDocx: importWithHostileReader } = await import('./importDocx.js');

    try {
      const source = new Blob([new Uint8Array([1])]);
      await expect(importWithHostileReader(source)).rejects.toMatchObject({
        name: 'DocxImportError',
        code: 'invalid_source',
        message: 'DOCX input must be a supported binary source.',
      });
      expect(getPrototypeOf).not.toHaveBeenCalled();
    } finally {
      if (originalArrayBuffer === undefined) {
        Reflect.deleteProperty(Blob.prototype, 'arrayBuffer');
      } else {
        Object.defineProperty(
          Blob.prototype,
          'arrayBuffer',
          originalArrayBuffer,
        );
      }
      vi.unstubAllGlobals();
      vi.resetModules();
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
