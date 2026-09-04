import { describe, expect, it } from 'vitest';

import { importDocx } from './importDocx.js';

function restoreGlobalProperty(
  key: 'FileReader',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor === undefined) {
    Reflect.deleteProperty(globalThis, key);
    return;
  }
  Object.defineProperty(globalThis, key, descriptor);
}

describe('DOCX Blob capability isolation', () => {
  it('does not let an own Blob override route through a replaced global FileReader', async () => {
    const originalFileReader = Object.getOwnPropertyDescriptor(
      globalThis,
      'FileReader',
    );
    let hostileConstructorCalls = 0;

    class HostileFileReader {
      constructor() {
        hostileConstructorCalls += 1;
        throw new Error('private FileReader sentinel');
      }
    }

    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      writable: true,
      value: HostileFileReader,
    });

    try {
      const source = new Blob([new Uint8Array([0x50, 0x4b])]);
      Object.defineProperty(source, 'arrayBuffer', {
        configurable: true,
        writable: true,
        value: undefined,
      });

      await expect(importDocx(source)).rejects.toMatchObject({
        code: 'invalid_zip',
      });
      expect(hostileConstructorCalls).toBe(0);
    } finally {
      restoreGlobalProperty('FileReader', originalFileReader);
    }
  });
});
