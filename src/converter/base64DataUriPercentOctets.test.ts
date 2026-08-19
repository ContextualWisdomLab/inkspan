import { describe, expect, it } from 'vitest';
import { Base64SizeError, dataUriToBytes } from './index.js';

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

  it('keeps every UTF-8 width and lone-surrogate replacement beside octets', () => {
    const text = 'Aé€😀\uD800';
    expect(Array.from(dataUriToBytes(`data:text/plain,${text}%FF`).bytes)).toEqual([
      ...new TextEncoder().encode(text),
      0xff,
    ]);
  });

  it('preflights exact percent-decoded size before materializing output bytes', () => {
    expect(() =>
      dataUriToBytes('data:application/octet-stream,%00%7F%80%FF', {
        maxBytes: 3,
      }),
    ).toThrow(Base64SizeError);
  });
});
