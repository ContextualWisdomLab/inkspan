import { describe, expect, it, vi } from 'vitest';

import { toUint8Array } from './index.js';

const INVALID_BINARY_INPUT = {
  name: 'TypeError',
  message: 'converter binary input is invalid.',
};

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

  function detach(buffer: ArrayBuffer): void {
    structuredClone(buffer, { transfer: [buffer] });
  }

  function captureFailure(run: () => unknown): unknown {
    try {
      run();
    } catch (error) {
      return error;
    }
    return undefined;
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

  it('normalizes detached DataView failures before range reconstruction', () => {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer, 1, 2);
    detach(buffer);

    const failure = captureFailure(() => toUint8Array(view));

    expect(failure).toMatchObject(INVALID_BINARY_INPUT);
  });

  it('normalizes detached non-byte typed-array failures before range reconstruction', () => {
    const buffer = new ArrayBuffer(4);
    const view = new Uint16Array(buffer, 0, 2);
    detach(buffer);

    const failure = captureFailure(() => toUint8Array(view));

    expect(failure).toMatchObject(INVALID_BINARY_INPUT);
  });
});
