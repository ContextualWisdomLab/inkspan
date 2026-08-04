import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  DocumentEnvelopeError,
  createDocumentEnvelope,
} from './documentEnvelope.js';
import {
  encodeDocumentEnvelope,
  serializeDocumentEnvelope,
} from './documentEnvelopeCanonical.js';
import * as publicApi from './index.js';

describe('canonical document envelope serialization', () => {
  it('sorts object properties recursively while preserving array order', () => {
    const envelope = createDocumentEnvelope({
      type: 'doc',
      attrs: { zeta: 1, alpha: 2, active: true, disabled: false, absent: null },
      content: [
        {
          type: 'paragraph',
          attrs: { second: false, first: 'value' },
        },
      ],
    });

    expect(serializeDocumentEnvelope(envelope)).toBe(
      `{"documentJson":{"attrs":{"absent":null,"active":true,"alpha":2,"disabled":false,"zeta":1},"content":[{"attrs":{"first":"value","second":false},"type":"paragraph"}],"type":"doc"},"schemaId":"${DOCUMENT_ENVELOPE_SCHEMA_ID}","schemaVersion":${DOCUMENT_ENVELOPE_SCHEMA_VERSION}}`,
    );
  });

  it('produces identical text for equivalent insertion orders', () => {
    const first = createDocumentEnvelope({
      type: 'doc',
      attrs: { beta: 2, alpha: 1 },
    });
    const second = createDocumentEnvelope({
      attrs: { alpha: 1, beta: 2 },
      type: 'doc',
    });

    expect(serializeDocumentEnvelope(first)).toBe(
      serializeDocumentEnvelope(second),
    );
  });

  it('uses ECMAScript number serialization and RFC 8785 UTF-16 key order', () => {
    const envelope = createDocumentEnvelope({
      type: 'doc',
      attrs: {
        numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 1e-27],
        '\u20ac': 'Euro Sign',
        '\r': 'Carriage Return',
        '\ufb33': 'Hebrew Letter Dalet With Dagesh',
        '1': 'One',
        '\ud83d\ude00': 'Emoji: Grinning Face',
        '\u0080': 'Control',
        '\u00f6': 'Latin Small Letter O With Diaeresis',
      },
    });

    const serialized = serializeDocumentEnvelope(envelope);
    expect(serialized).toContain(
      '"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27]',
    );
    const orderedValues = [
      'Carriage Return',
      'One',
      'Control',
      'Latin Small Letter O With Diaeresis',
      'Euro Sign',
      'Emoji: Grinning Face',
      'Hebrew Letter Dalet With Dagesh',
    ];
    const offsets = orderedValues.map((value) => serialized.indexOf(value));
    expect(offsets.every((offset) => offset >= 0)).toBe(true);
    expect(offsets).toEqual([...offsets].sort((left, right) => left - right));
  });

  it('rejects negative zero under the verified RFC 8785 errata', () => {
    const envelope = createDocumentEnvelope({
      type: 'doc',
      attrs: { unsafeNumericValue: -0 },
    });

    expect(() => serializeDocumentEnvelope(envelope)).toThrow(
      DocumentEnvelopeError,
    );
    expect(() => serializeDocumentEnvelope(envelope)).toThrow(
      'negative zero',
    );
    expect(() => encodeDocumentEnvelope(envelope)).toThrow('negative zero');
  });

  it('encodes canonical JSON as UTF-8 without a byte-order mark', () => {
    const envelope = createDocumentEnvelope({
      type: 'doc',
      attrs: { label: '문서 😀' },
    });

    const text = serializeDocumentEnvelope(envelope);
    const bytes = encodeDocumentEnvelope(envelope);

    expect(new TextDecoder().decode(bytes)).toBe(text);
    expect([...bytes.slice(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
  });

  it.each([
    { type: 'doc', attrs: { value: '\ud800' } },
    { type: 'doc', attrs: { value: '\udc00' } },
    { type: 'doc', attrs: { ['\ud800']: 'invalid-key' } },
    { type: 'doc', attrs: { ['\udc00']: 'invalid-key' } },
  ])('rejects lone UTF-16 surrogates: %j', (documentJson) => {
    const envelope = createDocumentEnvelope(documentJson);
    expect(() => serializeDocumentEnvelope(envelope)).toThrow(
      DocumentEnvelopeError,
    );
    expect(() => serializeDocumentEnvelope(envelope)).toThrow(
      'valid Unicode scalar strings',
    );
  });

  it('applies the existing fail-closed envelope contract before serialization', () => {
    expect(() =>
      serializeDocumentEnvelope({
        schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
        schemaVersion: 999,
        documentJson: { type: 'doc' },
      }),
    ).toThrow(DocumentEnvelopeError);
  });

  it('exports the canonical APIs from the root package surface', () => {
    expect(publicApi.serializeDocumentEnvelope).toBe(
      serializeDocumentEnvelope,
    );
    expect(publicApi.encodeDocumentEnvelope).toBe(encodeDocumentEnvelope);
  });
});
