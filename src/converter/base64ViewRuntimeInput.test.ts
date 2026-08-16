import { describe, expect, it, vi } from 'vitest';

import { toUint8Array } from './index.js';

describe('converter binary-view runtime boundary', () => {
  function shadowByteRangeAccessors(view: ArrayBufferView) {
    const privateSentinel = new Error('private binary-view accessor sentinel');
    const readCallerAccessor = vi.fn((): never => {
      throw privateSentinel;
    });

    Object.defineProperties(view, {
      buffer: { get: readCallerAccessor },
      byteOffset: { get: readCallerAccessor },
      byteLength: { get: readCallerAccessor },
    });

    return readCallerAccessor;
  }

  it('does not evaluate caller-overridden DataView byte-range accessors', () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const view = new DataView(source.buffer, 1, 2);
    const readCallerAccessor = shadowByteRangeAccessors(view);

    expect(Array.from(toUint8Array(view))).toEqual([2, 3]);
    expect(readCallerAccessor).not.toHaveBeenCalled();
  });

  it('does not evaluate caller-overridden typed-array byte-range accessors', () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const view = new Uint16Array(source.buffer, 2, 1);
    const readCallerAccessor = shadowByteRangeAccessors(view);

    expect(Array.from(toUint8Array(view))).toEqual([3, 4]);
    expect(readCallerAccessor).not.toHaveBeenCalled();
  });
});
