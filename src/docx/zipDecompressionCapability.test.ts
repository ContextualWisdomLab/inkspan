import { describe, expect, it, vi } from 'vitest';

import { buildZip } from '../../test/docxFixture.js';
import { DEFAULT_DOCX_IMPORT_LIMITS } from './limits.js';
import { ZipArchive } from './zip.js';

describe('DOCX ZIP decompression capability isolation', () => {
  it('does not let later global stream replacement redirect deflate reads', async () => {
    expect(typeof DecompressionStream).toBe('function');
    expect(typeof ReadableStream).toBe('function');

    let hostileDecompressionCalls = 0;
    let hostileReadableCalls = 0;

    class HostileDecompressionStream {
      constructor() {
        hostileDecompressionCalls += 1;
        throw new Error('private decompression sentinel');
      }
    }
    class HostileReadableStream {
      constructor() {
        hostileReadableCalls += 1;
        throw new Error('private readable sentinel');
      }
    }

    vi.stubGlobal('DecompressionStream', HostileDecompressionStream);
    vi.stubGlobal('ReadableStream', HostileReadableStream);

    try {
      const archive = ZipArchive.parse(
        buildZip({ 'compressed.txt': 'trusted compressed payload' }, 8),
        DEFAULT_DOCX_IMPORT_LIMITS,
      );
      await expect(
        archive.read('compressed.txt').then((bytes) => new TextDecoder().decode(bytes)),
      ).resolves.toBe('trusted compressed payload');
      expect(hostileDecompressionCalls).toBe(0);
      expect(hostileReadableCalls).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not let later Uint8Array.from replacement redirect deflate input copies', async () => {
    const archiveBytes = buildZip(
      { 'compressed.txt': 'trusted compressed payload' },
      8,
    );
    const fromDescriptor = Object.getOwnPropertyDescriptor(Uint8Array, 'from');
    expect(fromDescriptor).toBeDefined();
    let hostileFromCalls = 0;

    Object.defineProperty(Uint8Array, 'from', {
      configurable: true,
      writable: true,
      value() {
        hostileFromCalls += 1;
        throw new Error('private Uint8Array.from sentinel');
      },
    });

    try {
      const archive = ZipArchive.parse(archiveBytes, DEFAULT_DOCX_IMPORT_LIMITS);
      await expect(
        archive.read('compressed.txt').then((bytes) => new TextDecoder().decode(bytes)),
      ).resolves.toBe('trusted compressed payload');
      expect(hostileFromCalls).toBe(0);
    } finally {
      Object.defineProperty(Uint8Array, 'from', fromDescriptor!);
    }
  });
});
