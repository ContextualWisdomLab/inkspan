import { describe, expect, it } from 'vitest';
import { bytesToBase64, bytesToDataUri, toUint8Array } from './index.js';

const INVALID_BINARY_INPUT = {
  name: 'TypeError',
  message: 'converter binary input is invalid.',
};

function hostileArrayLike(): {
  value: object;
  wasLengthRead: () => boolean;
} {
  let lengthRead = false;
  const value = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(value, 'length', {
    enumerable: true,
    configurable: true,
    get() {
      lengthRead = true;
      return 1;
    },
  });
  value[0] = 0x61;
  return { value, wasLengthRead: () => lengthRead };
}

function prototypeSpoofedUint8Array(): {
  value: object;
  wasByteLengthRead: () => boolean;
} {
  let byteLengthRead = false;
  const value = Object.create(Uint8Array.prototype) as Record<string, unknown>;
  Object.defineProperty(value, 'byteLength', {
    enumerable: false,
    configurable: true,
    get() {
      byteLengthRead = true;
      return 0;
    },
  });
  return { value, wasByteLengthRead: () => byteLengthRead };
}

function detachedUint8Array(): Uint8Array {
  const buffer = new ArrayBuffer(4);
  const view = new Uint8Array(buffer);
  structuredClone(buffer, { transfer: [buffer] });
  return view;
}

function captureFailure(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('converter binary input runtime boundary', () => {
  it('rejects coercible array-like objects before Uint8Array construction', () => {
    const hostile = hostileArrayLike();

    const failure = captureFailure(() => toUint8Array(hostile.value as never));

    expect(hostile.wasLengthRead()).toBe(false);
    expect(failure).toMatchObject(INVALID_BINARY_INPUT);
  });

  it('rejects coercible array-like objects before data-URI encoding', () => {
    const hostile = hostileArrayLike();

    const failure = captureFailure(() =>
      bytesToDataUri(hostile.value as never),
    );

    expect(hostile.wasLengthRead()).toBe(false);
    expect(failure).toMatchObject(INVALID_BINARY_INPUT);
  });

  it('rejects prototype-spoofed Uint8Array values instead of accepting instanceof alone', () => {
    const hostile = prototypeSpoofedUint8Array();

    const failure = captureFailure(() => toUint8Array(hostile.value as never));

    expect(hostile.wasByteLengthRead()).toBe(false);
    expect(failure).toMatchObject(INVALID_BINARY_INPUT);
  });

  it('rejects prototype-spoofed Uint8Array values before caller-member access', () => {
    const hostile = prototypeSpoofedUint8Array();

    const failure = captureFailure(() =>
      bytesToDataUri(hostile.value as never),
    );

    expect(hostile.wasByteLengthRead()).toBe(false);
    expect(failure).toMatchObject(INVALID_BINARY_INPUT);
  });

  it('rejects detached Uint8Array values at the conversion boundary', () => {
    const failure = captureFailure(() => toUint8Array(detachedUint8Array()));

    expect(failure).toMatchObject(INVALID_BINARY_INPUT);
  });

  it('normalizes detached Uint8Array failures before data-URI encoding', () => {
    const failure = captureFailure(() => bytesToDataUri(detachedUint8Array()));

    expect(failure).toMatchObject(INVALID_BINARY_INPUT);
  });

  it('normalizes detached Uint8Array failures before direct base64 encoding', () => {
    const failure = captureFailure(() => bytesToBase64(detachedUint8Array()));

    expect(failure).toMatchObject(INVALID_BINARY_INPUT);
  });
});
