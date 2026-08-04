import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  DocumentEnvelopeError,
  createDocumentEnvelope,
  parseDocumentEnvelopeBytes,
} from './documentEnvelope.js';
import { encodeDocumentEnvelope } from './documentEnvelopeCanonical.js';

describe('strict UTF-8 document envelope decoding', () => {
  it('round-trips canonical encoder bytes across runtime realms at the exact byte ceiling', () => {
    const envelope = createDocumentEnvelope({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '한국어 document' }],
        },
      ],
    });
    const bytes = encodeDocumentEnvelope(envelope);

    expect(
      parseDocumentEnvelopeBytes(bytes, { maxUtf8Bytes: bytes.byteLength }),
    ).toEqual(envelope);
  });

  it('accepts Node-compatible Uint8Array subclasses through a detached copy', () => {
    class EnvelopeBytes extends Uint8Array {}
    const source = JSON.stringify({
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: { type: 'doc' },
    });
    const bytes = new EnvelopeBytes(new TextEncoder().encode(source));

    expect(parseDocumentEnvelopeBytes(bytes).documentJson).toEqual({
      type: 'doc',
    });
  });

  it('rejects non-byte inputs and oversized byte sequences before decoding', () => {
    expect(() =>
      parseDocumentEnvelopeBytes('not-bytes' as unknown),
    ).toThrow('Uint8Array');

    const bytes = new TextEncoder().encode('{}');
    expect(() =>
      parseDocumentEnvelopeBytes(bytes, {
        maxUtf8Bytes: bytes.byteLength - 1,
      }),
    ).toThrow('UTF-8 bytes exceed');
  });

  it('rejects a UTF-8 byte-order mark instead of silently discarding it', () => {
    const payload = new TextEncoder().encode(
      JSON.stringify({
        schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
        schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
        documentJson: { type: 'doc' },
      }),
    );
    const bytes = new Uint8Array(payload.byteLength + 3);
    bytes.set([0xef, 0xbb, 0xbf]);
    bytes.set(payload, 3);

    expect(() => parseDocumentEnvelopeBytes(bytes)).toThrow(
      'byte-order mark',
    );
  });

  it('rejects malformed UTF-8 without replacement characters', () => {
    expect(() =>
      parseDocumentEnvelopeBytes(new Uint8Array([0xc3, 0x28])),
    ).toThrow('valid UTF-8');
  });

  it('delegates valid but empty UTF-8 text to canonical JSON validation', () => {
    expect(() => parseDocumentEnvelopeBytes(new Uint8Array())).toThrow(
      'valid JSON',
    );
  });

  it('redacts hostile byte-view failures', () => {
    const secret = 'tenant-secret-byte-buffer';
    const bytes = new Proxy(new Uint8Array([0x7b, 0x7d]), {
      get: () => {
        throw new Error(secret);
      },
    });

    try {
      parseDocumentEnvelopeBytes(bytes);
      throw new Error('Expected hostile bytes to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentEnvelopeError);
      expect(String(error)).not.toContain(secret);
    }
  });
});
