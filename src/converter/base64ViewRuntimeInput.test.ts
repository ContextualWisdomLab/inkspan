import { describe, expect, it, vi } from 'vitest';

import { toUint8Array } from './index.js';

describe('converter binary-view runtime boundary', () => {
  it('does not evaluate caller-overridden DataView byte-range accessors', () => {
    const privateSentinel = new Error('private DataView accessor sentinel');
    const readCallerAccessor = vi.fn((): never => {
      throw privateSentinel;
    });

    class HostileDataView extends DataView {
      override get buffer(): ArrayBuffer {
        return readCallerAccessor();
      }

      override get byteOffset(): number {
        return readCallerAccessor();
      }

      override get byteLength(): number {
        return readCallerAccessor();
      }
    }

    const source = new Uint8Array([1, 2, 3, 4]);
    const view = new HostileDataView(source.buffer, 1, 2);

    expect(Array.from(toUint8Array(view))).toEqual([2, 3]);
    expect(readCallerAccessor).not.toHaveBeenCalled();
  });
});
