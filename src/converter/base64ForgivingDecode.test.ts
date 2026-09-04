import { describe, expect, it } from 'vitest';

import { base64ToBytes, dataUriToBytes } from './index.js';

const INVALID_BASE64_MESSAGE = 'String is not valid base64 data.';

function expectInvalidBase64(decode: () => unknown): void {
  let caught: unknown;
  try {
    decode();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).name).toBe('Base64ParseError');
  expect((caught as Error).message).toBe(INVALID_BASE64_MESSAGE);
}

describe('WHATWG forgiving-base64 decode boundary', () => {
  it('rejects invalid alphabet before the environment decoder', () => {
    expectInvalidBase64(() => base64ToBytes('!!!!'));
    expectInvalidBase64(() =>
      dataUriToBytes('data:application/octet-stream;base64,!!!!'),
    );
  });

  it('rejects impossible length and invalid padding', () => {
    expectInvalidBase64(() => base64ToBytes('A'));
    expectInvalidBase64(() => base64ToBytes('aGVsbG8==='));
  });

  it('removes only ASCII whitespace and rejects non-ASCII whitespace', () => {
    const asciiWhitespace = 'aG\tV\ns\fb\rG 8=';
    expect(new TextDecoder().decode(base64ToBytes(asciiWhitespace))).toBe(
      'hello',
    );
    expectInvalidBase64(() => base64ToBytes('aG\u00a0VsbG8='));
  });

  it('preserves valid padded and unpadded forgiving-base64 input', () => {
    expect(new TextDecoder().decode(base64ToBytes('aGVsbG8='))).toBe('hello');
    expect(new TextDecoder().decode(base64ToBytes('aGVsbG8'))).toBe('hello');
  });
});
