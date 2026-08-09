import { describe, expect, it } from 'vitest';
import { DocumentEnvelopeError } from './documentEnvelope.js';
import {
  inspectDocumentEnvelopeIdentity,
  inspectDocumentEnvelopeIdentityBytes,
} from './documentEnvelopeIdentity.js';
import {
  inspectDocumentEnvelopeIdentity as inspectFrameworkFreeIdentity,
  inspectDocumentEnvelopeIdentityBytes as inspectFrameworkFreeIdentityBytes,
} from './envelope-identity/index.js';

const validEnvelope = () => ({
  schemaId: 'https://inkspan.io/schemas/document-envelope/v9',
  schemaVersion: 9,
  documentJson: { type: 'legacy', content: [null, true, false, 'text', 42] },
});

function expectDocumentEnvelopeError(operation: () => unknown, message?: RegExp | string) {
  try {
    operation();
    throw new Error('expected DocumentEnvelopeError');
  } catch (error) {
    expect(error).toBeInstanceOf(DocumentEnvelopeError);
    if (message !== undefined) {
      if (typeof message === 'string') {
        expect(String(error)).toContain(message);
      } else {
        expect(String(error)).toMatch(message);
      }
    }
  }
}

describe('document envelope identity branch coverage', () => {
  it('exercises the framework-independent wrappers for object and byte input', () => {
    const source = validEnvelope();
    const expected = { schemaId: source.schemaId, schemaVersion: 9 };

    expect(inspectFrameworkFreeIdentity(source)).toEqual(expected);
    expect(
      inspectFrameworkFreeIdentityBytes(
        new TextEncoder().encode(JSON.stringify(source)),
      ),
    ).toEqual(expected);
  });

  it('rejects non-byte input, oversized bytes, and short valid bytes', () => {
    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentityBytes('not-bytes'),
      'must be a Uint8Array',
    );
    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentityBytes(new Uint8Array([0x7b, 0x7d]), {
          maxUtf8Bytes: 1,
        }),
      'exceed the supported length',
    );
    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentityBytes(new Uint8Array([0x7b, 0x7d])),
      'requires schemaId',
    );
  });

  it('rejects overlong JSON text and non-object decoded values', () => {
    const source = JSON.stringify(validEnvelope());
    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity(source, {
          maxJsonTextCodeUnits: source.length - 1,
        }),
      'JSON text exceeds',
    );

    for (const value of ['null', '[]', 'true', '1', '"string"']) {
      expectDocumentEnvelopeError(
        () => inspectDocumentEnvelopeIdentity(value),
        'must be an object',
      );
    }
  });

  it('enforces value-count and nesting ceilings before JSON.parse', () => {
    const tooManyValues = JSON.stringify({
      schemaId: 'legacy',
      schemaVersion: 1,
      documentJson: { one: 1, two: 2 },
    });
    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentity(tooManyValues, { maxJsonValues: 1 }),
      'JSON value count',
    );

    const tooDeep = JSON.stringify({
      schemaId: 'legacy',
      schemaVersion: 1,
      documentJson: { nested: { deeper: true } },
    });
    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentity(tooDeep, { maxNestingDepth: 1 }),
      'nesting depth',
    );
  });

  it('rejects too many top-level fields under the configured value ceiling', () => {
    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity(
          {
            ...validEnvelope(),
            futureA: 1,
            futureB: 2,
          },
          { maxJsonValues: 1 },
        ),
      'too many top-level fields',
    );
  });

  it('validates inert future fields without returning them', () => {
    const identity = inspectDocumentEnvelopeIdentity({
      ...validEnvelope(),
      futureRoutingHint: { nested: ['safe', true] },
    });
    expect(identity).toEqual({
      schemaId: validEnvelope().schemaId,
      schemaVersion: 9,
    });
    expect('futureRoutingHint' in identity).toBe(false);

    for (const futureRoutingHint of [
      () => undefined,
      Symbol('future'),
      Number.NaN,
      new Date(),
    ]) {
      expectDocumentEnvelopeError(() =>
        inspectDocumentEnvelopeIdentity({
          ...validEnvelope(),
          futureRoutingHint,
        }),
      );
    }
  });

  it('rejects invalid schema identifiers and each invalid schema-version class', () => {
    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentity({ ...validEnvelope(), schemaId: 3 }),
      'schemaId must be a string',
    );

    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity(
          { ...validEnvelope(), schemaId: 'x'.repeat(61) },
          { maxStringCodeUnits: 60 },
        ),
      'strings exceed',
    );

    for (const schemaVersion of [
      '9',
      Number.NaN,
      Number.POSITIVE_INFINITY,
      1.25,
      Number.MAX_SAFE_INTEGER + 1,
      0,
      -1,
    ]) {
      expectDocumentEnvelopeError(
        () =>
          inspectDocumentEnvelopeIdentity({
            ...validEnvelope(),
            schemaVersion,
          }),
        'positive safe integer',
      );
    }
  });

  it('covers every JSON scalar class and rejects non-finite or non-JSON primitives', () => {
    for (const documentJson of [null, true, false, 'text', 0, -2.5]) {
      expect(
        inspectDocumentEnvelopeIdentity({ ...validEnvelope(), documentJson }),
      ).toEqual({
        schemaId: validEnvelope().schemaId,
        schemaVersion: 9,
      });
    }

    for (const documentJson of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      undefined,
      1n,
      Symbol('x'),
      () => undefined,
    ]) {
      expectDocumentEnvelopeError(() =>
        inspectDocumentEnvelopeIdentity({ ...validEnvelope(), documentJson }),
      );
    }
  });

  it('rejects cycles, unsupported object prototypes, and oversized strings', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity({
          ...validEnvelope(),
          documentJson: cyclic,
        }),
      'cyclic reference',
    );

    for (const documentJson of [new Date(), new Map(), new Set()]) {
      expectDocumentEnvelopeError(
        () =>
          inspectDocumentEnvelopeIdentity({ ...validEnvelope(), documentJson }),
        'JSON-compatible values',
      );
    }

    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity(
          { ...validEnvelope(), documentJson: 'x'.repeat(80) },
          { maxStringCodeUnits: 60 },
        ),
      'strings exceed',
    );
  });

  it('accepts null-prototype JSON objects', () => {
    const body = Object.create(null) as Record<string, unknown>;
    body.value = 1;
    expect(
      inspectDocumentEnvelopeIdentity({ ...validEnvelope(), documentJson: body }),
    ).toEqual({
      schemaId: validEnvelope().schemaId,
      schemaVersion: 9,
    });
  });

  it('rejects sparse, decorated, non-enumerable, and accessor arrays', () => {
    const sparse = new Array(1);
    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity({
          ...validEnvelope(),
          documentJson: sparse,
        }),
      'dense JSON elements',
    );

    const missingIndex = new Array(1) as unknown[] & { extra?: string };
    missingIndex.extra = 'x';
    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity({
          ...validEnvelope(),
          documentJson: missingIndex,
        }),
      'dense JSON elements',
    );

    const nonEnumerable = ['x'];
    Object.defineProperty(nonEnumerable, '0', {
      value: 'x',
      enumerable: false,
      configurable: true,
      writable: true,
    });
    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity({
          ...validEnvelope(),
          documentJson: nonEnumerable,
        }),
      'dense JSON elements',
    );

    const accessor = ['x'];
    Object.defineProperty(accessor, '0', {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error('must-not-run');
      },
    });
    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity({
          ...validEnvelope(),
          documentJson: accessor,
        }),
      'dense JSON elements',
    );
  });

  it('rejects top-level symbol, non-enumerable, accessor, and missing descriptors', () => {
    const symbolEnvelope = validEnvelope() as Record<PropertyKey, unknown>;
    symbolEnvelope[Symbol('private')] = 'value';
    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentity(symbolEnvelope),
      'enumerable JSON data fields',
    );

    const nonEnumerableEnvelope = validEnvelope();
    Object.defineProperty(nonEnumerableEnvelope, 'future', {
      value: 'x',
      enumerable: false,
    });
    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentity(nonEnumerableEnvelope),
      'enumerable JSON data fields',
    );

    const accessorEnvelope = validEnvelope();
    Object.defineProperty(accessorEnvelope, 'future', {
      enumerable: true,
      get() {
        throw new Error('must-not-run');
      },
    });
    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentity(accessorEnvelope),
      'enumerable JSON data fields',
    );

    const descriptorless = new Proxy(validEnvelope(), {
      ownKeys() {
        return ['schemaId', 'schemaVersion', 'documentJson', 'future'];
      },
      getOwnPropertyDescriptor(target, property) {
        if (property === 'future') return undefined;
        return Object.getOwnPropertyDescriptor(target, property);
      },
    });
    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentity(descriptorless),
      'enumerable JSON data fields',
    );
  });

  it('rejects overlong object names', () => {
    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity(
          {
            ...validEnvelope(),
            ['x'.repeat(61)]: 1,
          },
          { maxStringCodeUnits: 60 },
        ),
      'strings exceed',
    );
  });

  it('covers default, partial, undefined, unknown, excessive, and invalid limits', () => {
    expect(inspectDocumentEnvelopeIdentity(validEnvelope())).toEqual({
      schemaId: validEnvelope().schemaId,
      schemaVersion: 9,
    });
    expect(
      inspectDocumentEnvelopeIdentity(validEnvelope(), {
        maxUtf8Bytes: undefined,
        maxJsonTextCodeUnits: undefined,
        maxJsonValues: undefined,
        maxStringCodeUnits: undefined,
        maxNestingDepth: undefined,
      }),
    ).toEqual({ schemaId: validEnvelope().schemaId, schemaVersion: 9 });

    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentity(validEnvelope(), [] as never),
      'plain configuration object',
    );
    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity(validEnvelope(), {
          maxUtf8Bytes: 1,
          maxJsonTextCodeUnits: 1,
          maxJsonValues: 1,
          maxStringCodeUnits: 1,
          maxNestingDepth: 1,
          extra: 1,
        } as never),
      'unsupported fields',
    );
    expectDocumentEnvelopeError(
      () =>
        inspectDocumentEnvelopeIdentity(validEnvelope(), {
          maxUtf8Bytes: 1,
          extra: 1,
        } as never),
      'unsupported fields',
    );

    for (const invalid of ['1', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      for (const field of [
        'maxUtf8Bytes',
        'maxJsonTextCodeUnits',
        'maxJsonValues',
        'maxStringCodeUnits',
        'maxNestingDepth',
      ] as const) {
        expectDocumentEnvelopeError(
          () =>
            inspectDocumentEnvelopeIdentity(validEnvelope(), {
              [field]: invalid,
            } as never),
          'positive safe integers',
        );
      }
    }
  });

  it('returns false from hostile Uint8Array brand inspection without leaking the trap', () => {
    const { proxy, revoke } = Proxy.revocable(new Uint8Array([1]), {});
    revoke();
    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentityBytes(proxy),
      'must be a Uint8Array',
    );
  });

  it('redacts unexpected reflection failures but preserves deliberate public errors', () => {
    const hostile = new Proxy(validEnvelope(), {
      getPrototypeOf() {
        throw new Error('private-proxy-cause');
      },
    });
    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentity(hostile),
      'could not be inspected safely',
    );

    expectDocumentEnvelopeError(
      () => inspectDocumentEnvelopeIdentity({ schemaId: 'x' }),
      'requires schemaId, schemaVersion, and documentJson',
    );
  });
});
