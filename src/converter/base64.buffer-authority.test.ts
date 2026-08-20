import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64.js';

describe('base64 runtime authority', () => {
  it('does not let a later global Buffer replacement become codec authority', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Buffer');
    if (descriptor === undefined) {
      throw new Error('global Buffer descriptor is unavailable in the Node test runtime.');
    }
    const privateSentinel = new Error('private global Buffer sentinel');

    Object.defineProperty(globalThis, 'Buffer', {
      configurable: true,
      writable: true,
      value: {
        from(): never {
          throw privateSentinel;
        },
      },
    });

    try {
      expect(bytesToBase64(new Uint8Array([1, 2, 3, 4]))).toBe('AQIDBA==');
      expect(Array.from(base64ToBytes('AQIDBA=='))).toEqual([1, 2, 3, 4]);
    } finally {
      Object.defineProperty(globalThis, 'Buffer', descriptor);
    }
  });

  it('does not let a later Buffer.from replacement become codec authority', () => {
    const buffer = globalThis.Buffer;
    if (buffer === undefined) {
      throw new Error('global Buffer is unavailable in the Node test runtime.');
    }
    const descriptor = Object.getOwnPropertyDescriptor(buffer, 'from');
    if (descriptor === undefined) {
      throw new Error('Buffer.from descriptor is unavailable in the Node test runtime.');
    }
    const privateSentinel = new Error('private Buffer.from sentinel');

    Object.defineProperty(buffer, 'from', {
      ...descriptor,
      value(): never {
        throw privateSentinel;
      },
    });

    try {
      expect(bytesToBase64(new Uint8Array([1, 2, 3, 4]))).toBe('AQIDBA==');
      expect(Array.from(base64ToBytes('AQIDBA=='))).toEqual([1, 2, 3, 4]);
    } finally {
      Object.defineProperty(buffer, 'from', descriptor);
    }
  });
});
