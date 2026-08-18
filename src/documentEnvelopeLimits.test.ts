import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOCUMENT_ENVELOPE_LIMITS,
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  DocumentEnvelopeError,
  createDocumentEnvelope,
  parseDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from './documentEnvelope.js';

describe('document envelope resource limits', () => {
  it('exports frozen commercial defaults and accepts exact custom ceilings', () => {
    expect(DEFAULT_DOCUMENT_ENVELOPE_LIMITS).toEqual({
      maxUtf8Bytes: 64 * 1024 * 1024,
      maxJsonTextCodeUnits: 64 * 1024 * 1024,
      maxJsonValues: 1_000_000,
      maxStringCodeUnits: 32 * 1024 * 1024,
      maxNestingDepth: 128,
    });
    expect(Object.isFrozen(DEFAULT_DOCUMENT_ENVELOPE_LIMITS)).toBe(true);

    const limits = {
      maxUtf8Bytes: 1_000,
      maxJsonTextCodeUnits: 1_000,
      maxJsonValues: 2,
      maxStringCodeUnits: 13,
      maxNestingDepth: 1,
    };
    const envelope = createDocumentEnvelope({ type: 'doc' }, limits);
    const source = JSON.stringify(envelope);

    expect(
      parseDocumentEnvelope(source, {
        ...limits,
        maxJsonTextCodeUnits: source.length,
      }),
    ).toEqual(envelope);
  });

  it('keeps raw envelope wrapper values outside document ceilings', () => {
    const envelope = createDocumentEnvelope(
      { type: 'doc' },
      { maxJsonValues: 2, maxNestingDepth: 1 },
    );

    expect(
      parseDocumentEnvelope(JSON.stringify(envelope), {
        maxJsonValues: 2,
        maxNestingDepth: 1,
      }),
    ).toEqual(envelope);
  });

  it('uses defaults for omitted and explicitly undefined overrides', () => {
    expect(
      createDocumentEnvelope(
        { type: 'doc' },
        {
          maxUtf8Bytes: undefined,
          maxJsonValues: undefined,
          maxNestingDepth: 1,
        },
      ).documentJson,
    ).toEqual({ type: 'doc' });
  });

  it('rejects raw JSON text before scanning or parsing past its ceiling', () => {
    const source = JSON.stringify({
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: { type: 'doc' },
    });

    expect(() =>
      parseDocumentEnvelope(source, {
        maxJsonTextCodeUnits: source.length - 1,
      }),
    ).toThrow('JSON text exceeds');
  });

  it('enforces structural ceilings before materializing raw JSON text', () => {
    const source = JSON.stringify({
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      },
    });

    expect(() =>
      parseDocumentEnvelope(source, { maxJsonValues: 2 }),
    ).toThrow('JSON value count');
    expect(() =>
      parseDocumentEnvelope(source, { maxNestingDepth: 1 }),
    ).toThrow('nesting depth');
  });

  it('enforces raw object-name ceilings during JSON preflight', () => {
    const oversizedName = 'x'.repeat(65);
    const source = JSON.stringify({
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: {
        type: 'doc',
        attrs: { [oversizedName]: true },
      },
    });

    expect(() =>
      parseDocumentEnvelope(source, { maxStringCodeUnits: 64 }),
    ).toThrow('strings exceed');
  });

  it('rejects object and array expansion past the JSON-value ceiling', () => {
    expect(() =>
      createDocumentEnvelope(
        { type: 'doc', content: [] },
        { maxJsonValues: 2 },
      ),
    ).toThrow('JSON value count');

    expect(() =>
      createDocumentEnvelope(
        { type: 'doc', content: [null, null] },
        { maxJsonValues: 4 },
      ),
    ).toThrow('JSON value count');
  });

  it('rejects overlong decoded values and object names', () => {
    expect(() =>
      createDocumentEnvelope(
        { type: 'doc', attrs: { note: '12345678901234' } },
        { maxStringCodeUnits: 13 },
      ),
    ).toThrow('strings exceed');

    expect(() =>
      createDocumentEnvelope(
        { type: 'doc', attrs: { descriptiveField: true } },
        { maxStringCodeUnits: 13 },
      ),
    ).toThrow('strings exceed');
  });

  it('applies a configurable nesting ceiling', () => {
    expect(() =>
      createDocumentEnvelope(
        {
          type: 'doc',
          content: [{ type: 'paragraph' }],
        },
        { maxNestingDepth: 2 },
      ),
    ).toThrow('nesting depth');
  });

  it('rejects non-plain, unknown, and invalid limit configuration', () => {
    expect(() =>
      createDocumentEnvelope(
        { type: 'doc' },
        [] as unknown as DocumentEnvelopeLimits,
      ),
    ).toThrow('plain configuration object');

    expect(() =>
      createDocumentEnvelope(
        { type: 'doc' },
        { unexpectedLimit: 1 } as unknown as DocumentEnvelopeLimits,
      ),
    ).toThrow('unsupported fields');

    for (const maxJsonValues of ['many', 1.5, 0]) {
      expect(() =>
        createDocumentEnvelope(
          { type: 'doc' },
          { maxJsonValues } as unknown as DocumentEnvelopeLimits,
        ),
      ).toThrow('positive safe integers');
    }
  });

  it('fails closed when hostile reflection hides reported properties', () => {
    const objectProxy = new Proxy(
      { type: 'doc' },
      {
        getOwnPropertyDescriptor: () => undefined,
      },
    );
    expect(() => createDocumentEnvelope(objectProxy)).toThrow(
      'enumerable JSON data fields',
    );

    const arrayProxy = new Proxy(['paragraph'], {
      getOwnPropertyDescriptor: (target, property) =>
        property === '0'
          ? undefined
          : Reflect.getOwnPropertyDescriptor(target, property),
    });
    expect(() =>
      createDocumentEnvelope({ type: 'doc', content: arrayProxy }),
    ).toThrow('dense JSON elements');
  });

  it('keeps limit failures typed and source-data-free', () => {
    const secret = 'customer-private-document';
    try {
      createDocumentEnvelope(
        { type: 'doc', attrs: { note: secret } },
        { maxStringCodeUnits: 13 },
      );
      throw new Error('Expected limit validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentEnvelopeError);
      expect(String(error)).not.toContain(secret);
    }
  });
});
