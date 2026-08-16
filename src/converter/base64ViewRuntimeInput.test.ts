import { describe, expect, it, vi } from 'vitest';

import { toUint8Array } from './index.js';

describe('converter binary-view runtime boundary', () => {
  it('does not evaluate caller-overridden DataView byte-range accessors', () => {
    const privateSentinel = new Error('private DataView accessor sentinel');
    const readCallerAccessor = vi.fn((): never => {
      throw privateSentinel;
    });
    const source = new Uint8Array([1, 2, 3, 4]);
    const view = new DataView(source.buffer, 1, 2);

    Object.defineProperties(view, {
      buffer: { get: readCallerAccessor },
      byteOffset: { get: readCallerAccessor },
      byteLength: { get: readCallerAccessor },
    });

    expect(Array.from(toUint8Array(view))).toEqual([2, 3]);
    expect(readCallerAccessor).not.toHaveBeenCalled();
  });
});
