import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  DocumentEnvelopeError,
  createDocumentEnvelope,
  parseDocumentEnvelope,
} from './documentEnvelope.js';

describe('document envelope', () => {
  it('creates a detached frozen versioned persistence envelope', () => {
    const documentJson = {
      type: 'doc',
      attrs: { enabled: true, score: 3, note: null },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    };

    const envelope = createDocumentEnvelope(documentJson);

    expect(envelope).toEqual({
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson,
    });
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.documentJson)).toBe(true);
    expect(Object.isFrozen(envelope.documentJson.content)).toBe(true);
    expect(envelope.documentJson).not.toBe(documentJson);
  });

  it('supports null-prototype JSON objects', () => {
    const documentJson = Object.assign(Object.create(null) as object, {
      type: 'doc',
      content: [],
    });

    expect(createDocumentEnvelope(documentJson).documentJson).toEqual({
      type: 'doc',
      content: [],
    });
  });

  it('parses JSON text and returns a detached frozen envelope', () => {
    const source = JSON.stringify({
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: { type: 'doc', content: [] },
    });

    const envelope = parseDocumentEnvelope(source);

    expect(envelope.documentJson).toEqual({ type: 'doc', content: [] });
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.documentJson)).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    { schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID },
    {
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
    },
    {
      schemaId: 'https://example.invalid/schema',
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: { type: 'doc' },
    },
    {
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: 2,
      documentJson: { type: 'doc' },
    },
    {
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: { type: 'paragraph' },
    },
    {
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: { type: 'doc' },
      ignored: true,
    },
  ])('rejects malformed or incompatible envelopes: %j', (value) => {
    expect(() => parseDocumentEnvelope(value)).toThrow(DocumentEnvelopeError);
  });

  it('rejects invalid JSON text without leaking the source', () => {
    const source = '{"secret":"tenant-token"';

    expect(() => parseDocumentEnvelope(source)).toThrow('valid JSON');
    try {
      parseDocumentEnvelope(source);
    } catch (error) {
      expect(String(error)).not.toContain('tenant-token');
    }
  });

  it('rejects cyclic and excessively nested document values', () => {
    const cyclic: Record<string, unknown> = { type: 'doc' };
    cyclic.content = [cyclic];

    expect(() => createDocumentEnvelope(cyclic)).toThrow('cyclic');

    let nested: Record<string, unknown> = { type: 'text', text: 'leaf' };
    for (let index = 0; index < 129; index += 1) {
      nested = { type: 'paragraph', content: [nested] };
    }

    expect(() =>
      createDocumentEnvelope({ type: 'doc', content: [nested] }),
    ).toThrow('nesting');
  });

  it.each([
    () => undefined,
    1n,
    Symbol('not-json'),
    undefined,
    new Date(0),
  ])('rejects non-JSON values: %s', (value) => {
    expect(() =>
      createDocumentEnvelope({ type: 'doc', attrs: { value } }),
    ).toThrow('JSON-compatible');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite numbers: %s',
    (value) => {
      expect(() =>
        createDocumentEnvelope({ type: 'doc', attrs: { value } }),
      ).toThrow('finite');
    },
  );
});
