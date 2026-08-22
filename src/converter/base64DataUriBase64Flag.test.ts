import { describe, expect, it } from 'vitest';
import { dataUriToBytes, parseDataUri } from './index.js';

describe('RFC 2397 data-URI base64 flag', () => {
  it('does not treat a base64 media-type parameter as the encoding flag', () => {
    expect(parseDataUri('data:text/plain;base64=1,SGVsbG8%3D')).toEqual({
      mimeType: 'text/plain',
      isBase64: false,
      payload: 'SGVsbG8%3D',
    });

    expect(
      new TextDecoder().decode(
        dataUriToBytes('data:text/plain;base64=1,SGVsbG8%3D').bytes,
      ),
    ).toBe('SGVsbG8=');
  });

  it('still recognizes an exact final base64 flag after media-type parameters', () => {
    expect(
      parseDataUri('data:text/plain;charset=utf-8;base64,SGVsbG8=').isBase64,
    ).toBe(true);
  });
});
