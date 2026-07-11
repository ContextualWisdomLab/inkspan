import { describe, it, expect } from 'vitest';
import {
  bytesToBase64,
  base64ToBytes,
  bytesToDataUri,
  blobToDataUri,
  fileToDataUri,
  dataUriToBytes,
  dataUriToBlob,
  dataUriByteLength,
  parseDataUri,
  isDataUri,
  sniffMimeType,
  toUint8Array,
  Base64SizeError,
  DataUriParseError,
} from './index.js';

// Minimal 1x1 transparent PNG (real magic bytes) for MIME + round-trip tests.
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

describe('base64 primitives', () => {
  it('encodes and decodes bytes losslessly', () => {
    const b64 = bytesToBase64(PNG_BYTES);
    expect(typeof b64).toBe('string');
    const back = base64ToBytes(b64);
    expect(Array.from(back)).toEqual(Array.from(PNG_BYTES));
  });

  it('matches known base64 output', () => {
    expect(bytesToBase64(new TextEncoder().encode('hello'))).toBe('aGVsbG8=');
    expect(new TextDecoder().decode(base64ToBytes('aGVsbG8='))).toBe('hello');
  });

  it('tolerates whitespace/newlines in base64 input', () => {
    const b64 = bytesToBase64(PNG_BYTES);
    const chunked = b64.replace(/(.{8})/g, '$1\n');
    expect(Array.from(base64ToBytes(chunked))).toEqual(Array.from(PNG_BYTES));
  });

  it('round-trips all 256 byte values', () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i++) all[i] = i;
    expect(Array.from(base64ToBytes(bytesToBase64(all)))).toEqual(
      Array.from(all),
    );
  });
});

describe('toUint8Array', () => {
  it('accepts ArrayBuffer, typed arrays, and Uint8Array', () => {
    const u8 = new Uint8Array([1, 2, 3]);
    expect(toUint8Array(u8)).toBe(u8);
    expect(Array.from(toUint8Array(u8.buffer))).toEqual([1, 2, 3]);
    const view = new Uint8Array(u8.buffer, 1, 2);
    expect(Array.from(toUint8Array(view))).toEqual([2, 3]);
  });
});

describe('MIME sniffing', () => {
  it('detects PNG', () => {
    expect(sniffMimeType(PNG_BYTES)).toBe('image/png');
  });
  it('detects JPEG', () => {
    expect(sniffMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
  });
  it('detects GIF', () => {
    expect(sniffMimeType(new TextEncoder().encode('GIF89a...'))).toBe(
      'image/gif',
    );
  });
  it('detects WEBP', () => {
    const webp = new Uint8Array(12);
    webp.set(new TextEncoder().encode('RIFF'), 0);
    webp.set(new TextEncoder().encode('WEBP'), 8);
    expect(sniffMimeType(webp)).toBe('image/webp');
  });
  it('detects PDF and SVG', () => {
    expect(sniffMimeType(new TextEncoder().encode('%PDF-1.7'))).toBe(
      'application/pdf',
    );
    expect(sniffMimeType(new TextEncoder().encode('<svg xmlns='))).toBe(
      'image/svg+xml',
    );
  });
  it('detects SVG wrapped in an XML prolog', () => {
    expect(
      sniffMimeType(new TextEncoder().encode('<?xml version="1.0"?><svg>')),
    ).toBe('image/svg+xml');
  });
  it('does not treat a non-SVG XML document as an image', () => {
    expect(
      sniffMimeType(new TextEncoder().encode('<?xml version="1.0"?><root/>')),
    ).toBeUndefined();
  });
  it('returns undefined for unknown bytes', () => {
    expect(sniffMimeType(new Uint8Array([0x00, 0x01, 0x02]))).toBeUndefined();
  });
});

describe('bytesToDataUri', () => {
  it('builds a data URI with sniffed MIME', () => {
    const uri = bytesToDataUri(PNG_BYTES);
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
  });
  it('honors an explicit MIME override', () => {
    const uri = bytesToDataUri(PNG_BYTES, { mimeType: 'application/x-thing' });
    expect(uri.startsWith('data:application/x-thing;base64,')).toBe(true);
  });
  it('falls back to octet-stream for unknown bytes', () => {
    const uri = bytesToDataUri(new Uint8Array([1, 2, 3]));
    expect(uri.startsWith('data:application/octet-stream;base64,')).toBe(true);
  });
  it('enforces the size guard', () => {
    expect(() => bytesToDataUri(PNG_BYTES, { maxBytes: 4 })).toThrow(
      Base64SizeError,
    );
    try {
      bytesToDataUri(PNG_BYTES, { maxBytes: 4 });
    } catch (e) {
      expect(e).toBeInstanceOf(Base64SizeError);
      expect((e as Base64SizeError).maxBytes).toBe(4);
      expect((e as Base64SizeError).bytes).toBe(PNG_BYTES.byteLength);
    }
  });
});

describe('Blob/File encoding', () => {
  it('encodes a Blob, preferring its declared type', async () => {
    const blob = new Blob([PNG_BYTES], { type: 'image/png' });
    const uri = await blobToDataUri(blob);
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
    expect(Array.from(dataUriToBytes(uri).bytes)).toEqual(
      Array.from(PNG_BYTES),
    );
  });
  it('sniffs when the Blob has no type', async () => {
    const blob = new Blob([PNG_BYTES]);
    const uri = await blobToDataUri(blob);
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
  });
  it('fileToDataUri behaves like blobToDataUri', async () => {
    const file = new File([PNG_BYTES], 'x.png', { type: 'image/png' });
    const uri = await fileToDataUri(file);
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
  });
  it('rejects oversized blobs', async () => {
    const blob = new Blob([PNG_BYTES], { type: 'image/png' });
    await expect(blobToDataUri(blob, { maxBytes: 4 })).rejects.toBeInstanceOf(
      Base64SizeError,
    );
  });
});

describe('data URI parsing & decoding', () => {
  it('parses base64 data URIs', () => {
    const parsed = parseDataUri('data:image/png;base64,aGVsbG8=');
    expect(parsed).toEqual({
      mimeType: 'image/png',
      isBase64: true,
      payload: 'aGVsbG8=',
    });
  });
  it('parses non-base64 (text) data URIs', () => {
    const parsed = parseDataUri('data:text/plain,Hello%20World');
    expect(parsed.mimeType).toBe('text/plain');
    expect(parsed.isBase64).toBe(false);
  });
  it('defaults MIME to text/plain when omitted', () => {
    expect(parseDataUri('data:,abc').mimeType).toBe('text/plain');
  });
  it('throws on malformed input', () => {
    expect(() => parseDataUri('not-a-data-uri')).toThrow(DataUriParseError);
    expect(() => dataUriToBytes('http://example.com/x.png')).toThrow(
      DataUriParseError,
    );
  });
  it('isDataUri validates', () => {
    expect(isDataUri('data:image/png;base64,aGVsbG8=')).toBe(true);
    expect(isDataUri('https://example.com')).toBe(false);
  });
  it('decodes text data URIs via percent-decoding', () => {
    const { mimeType, bytes } = dataUriToBytes('data:text/plain,Hello%20World');
    expect(mimeType).toBe('text/plain');
    expect(new TextDecoder().decode(bytes)).toBe('Hello World');
  });
  it('dataUriByteLength reports decoded size', () => {
    const uri = bytesToDataUri(PNG_BYTES);
    expect(dataUriByteLength(uri)).toBe(PNG_BYTES.byteLength);
  });
  it('decode enforces size guard', () => {
    const uri = bytesToDataUri(PNG_BYTES);
    expect(() => dataUriToBytes(uri, { maxBytes: 4 })).toThrow(Base64SizeError);
  });
});

describe('full round-trip', () => {
  it('bytes -> dataUri -> bytes is lossless', () => {
    const uri = bytesToDataUri(PNG_BYTES);
    const { bytes, mimeType } = dataUriToBytes(uri);
    expect(mimeType).toBe('image/png');
    expect(Array.from(bytes)).toEqual(Array.from(PNG_BYTES));
  });
  it('dataUriToBlob yields a Blob with the right type & size', () => {
    const uri = bytesToDataUri(PNG_BYTES);
    const blob = dataUriToBlob(uri);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(PNG_BYTES.byteLength);
  });
});
