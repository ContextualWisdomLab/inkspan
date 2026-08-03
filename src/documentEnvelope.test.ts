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

  it('rejects non-JSON values and non-finite numbers', () => {
    expect(() =>
      createDocumentEnvelope({
        type: 'doc',
        attrs: { callback: () => undefined },
      }),
    ).toThrow('JSON-compatible');

    expect(() =>
      createDocumentEnvelope({ type: 'doc', attrs: { score: Number.NaN } }),
    ).toThrow('finite');
  });
});
