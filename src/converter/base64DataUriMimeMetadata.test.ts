import { describe, expect, it } from 'vitest';
import {
  DataUriParseError,
  dataUriToBytes,
  parseDataUri,
} from './base64.js';

describe('data URI MIME metadata resource boundary', () => {
  it('rejects oversized declared MIME metadata before payload decoding', () => {
    const oversizedMimeType = 'a'.repeat(1_025);

    expect(() =>
      dataUriToBytes(`data:${oversizedMimeType},%GG`),
    ).toThrow(
      new DataUriParseError(
        'Data URI MIME type must not exceed 1024 UTF-16 code units.',
      ),
    );
  });

  it('accepts declared MIME metadata at the local resource ceiling', () => {
    const exactBoundaryMimeType = 'a'.repeat(1_024);

    expect(parseDataUri(`data:${exactBoundaryMimeType},payload`)).toEqual({
      mimeType: exactBoundaryMimeType,
      isBase64: false,
      payload: 'payload',
    });
  });

  it('preserves the default MIME type when the declaration is omitted', () => {
    expect(parseDataUri('data:,payload')).toEqual({
      mimeType: 'text/plain',
      isBase64: false,
      payload: 'payload',
    });
  });
});
