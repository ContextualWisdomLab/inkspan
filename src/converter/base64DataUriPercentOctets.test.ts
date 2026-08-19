import { describe, expect, it } from 'vitest';
import { dataUriToBytes } from './index.js';

describe('RFC 2397 percent-encoded octets', () => {
  it('decodes percent escapes as raw bytes rather than UTF-8 text escapes', () => {
    expect(
      Array.from(
        dataUriToBytes(
          'data:application/octet-stream,%00%7F%80%FF',
        ).bytes,
      ),
    ).toEqual([0x00, 0x7f, 0x80, 0xff]);
  });

  it('keeps ordinary Unicode text encoded as UTF-8 beside escaped octets', () => {
    expect(
      Array.from(dataUriToBytes('data:text/plain,é%FF').bytes),
    ).toEqual([0xc3, 0xa9, 0xff]);
  });
});
