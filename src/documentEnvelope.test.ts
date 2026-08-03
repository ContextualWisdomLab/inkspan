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

  it('preserves __proto__ as inert own JSON data', () => {
    const documentJson = JSON.parse(
      '{"type":"doc","attrs":{"__proto__":{"polluted":true}}}',
    ) as unknown;

    const envelope = createDocumentEnvelope(documentJson);
    const attrs = envelope.documentJson.attrs as Record<string, unknown>;

    expect(Object.getPrototypeOf(attrs)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(attrs, '__proto__')).toBe(true);
    expect(attrs.__proto__).toEqual({ polluted: true });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
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
    7,
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
    expectRedactedFailure(() => parseDocumentEnvelope(source), 'tenant-token');
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

  it('rejects accessor, symbol, and non-enumerable object fields', () => {
    const accessorDocument: Record<PropertyKey, unknown> = { type: 'doc' };
    Object.defineProperty(accessorDocument, 'content', {
      enumerable: true,
      get: () => [],
    });

    const symbolDocument: Record<PropertyKey, unknown> = { type: 'doc' };
    symbolDocument[Symbol('private-field')] = 'hidden';

    const nonEnumerableDocument: Record<PropertyKey, unknown> = { type: 'doc' };
    Object.defineProperty(nonEnumerableDocument, 'privateField', {
      enumerable: false,
      value: 'hidden',
    });

    for (const documentJson of [
      accessorDocument,
      symbolDocument,
      nonEnumerableDocument,
    ]) {
      expect(() => createDocumentEnvelope(documentJson)).toThrow(
        'enumerable JSON data fields',
      );
    }
  });

  it('rejects sparse, decorated, non-enumerable, and accessor arrays', () => {
    const sparseArray = new Array<unknown>(1);

    const decoratedArray: unknown[] & { extraField?: string } = [];
    decoratedArray.length = 1;
    decoratedArray.extraField = 'replacement-for-missing-index';

    const nonEnumerableArray: unknown[] = [];
    Object.defineProperty(nonEnumerableArray, '0', {
      enumerable: false,
      value: 'hidden',
    });

    const accessorArray: unknown[] = [];
    Object.defineProperty(accessorArray, '0', {
      enumerable: true,
      get: () => 'computed',
    });

    for (const content of [
      sparseArray,
      decoratedArray,
      nonEnumerableArray,
      accessorArray,
    ]) {
      expect(() =>
        createDocumentEnvelope({ type: 'doc', content }),
      ).toThrow('dense JSON elements');
    }
  });

  it('redacts hostile proxy and accessor failures without executing getters', () => {
    const secret = 'tenant-secret-value';
    let getterWasCalled = false;
    const accessorDocument: Record<string, unknown> = { type: 'doc' };
    Object.defineProperty(accessorDocument, 'content', {
      enumerable: true,
      get: () => {
        getterWasCalled = true;
        throw new Error(secret);
      },
    });

    expectRedactedFailure(
      () => createDocumentEnvelope(accessorDocument),
      secret,
    );
    expect(getterWasCalled).toBe(false);

    const hostileDocument = new Proxy(
      { type: 'doc' },
      {
        getPrototypeOf: () => {
          throw new Error(secret);
        },
      },
    );
    expectRedactedFailure(() => createDocumentEnvelope(hostileDocument), secret);

    const hostileEnvelope = new Proxy(
      {
        schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
        schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
        documentJson: { type: 'doc' },
      },
      {
        ownKeys: () => {
          throw new Error(secret);
        },
      },
    );
    expectRedactedFailure(() => parseDocumentEnvelope(hostileEnvelope), secret);
  });
});

function expectRedactedFailure(operation: () => unknown, secret: string): void {
  try {
    operation();
    throw new Error('Expected operation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(DocumentEnvelopeError);
    expect(String(error)).not.toContain(secret);
  }
}
