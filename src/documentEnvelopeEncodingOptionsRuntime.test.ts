import { describe, expect, it } from 'vitest';
import {
  DocumentEnvelopeError,
  createDocumentEnvelope,
} from './documentEnvelope.js';
import {
  encodeDocumentEnvelope,
  type DocumentEnvelopeEncodingOptions,
} from './documentEnvelopeCanonical.js';

const ENVELOPE = createDocumentEnvelope({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Canonical option boundary' }],
    },
  ],
});
const INVALID_OPTIONS_MESSAGE =
  'Canonical document envelope encoding options are invalid';

function expectInvalidOptions(options: unknown): void {
  expect(() =>
    encodeDocumentEnvelope(
      ENVELOPE,
      options as DocumentEnvelopeEncodingOptions,
    ),
  ).toThrowError(new DocumentEnvelopeError(INVALID_OPTIONS_MESSAGE));
}

describe('document envelope encoding option runtime boundary', () => {
  it('rejects malformed option containers through one redacted error', () => {
    expectInvalidOptions(null);
    expectInvalidOptions(7);
    expectInvalidOptions([]);
  });

  it('rejects exotic object prototypes instead of treating them as empty options', () => {
    expectInvalidOptions(new Date(0));

    class HostOptions {
      maxUtf8Bytes = 1024;
    }
    expectInvalidOptions(new HostOptions());
  });

  it('rejects unknown string and symbol keys instead of silently defaulting', () => {
    expectInvalidOptions({ maxUTF8Bytes: 1024 });
    expectInvalidOptions({ [Symbol('private option')]: 1024 });
  });

  it('rejects accessor and non-enumerable option properties without reading them', () => {
    let getterCalls = 0;
    const accessorOptions = {};
    Object.defineProperty(accessorOptions, 'maxUtf8Bytes', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('private option getter detail');
      },
    });
    expectInvalidOptions(accessorOptions);
    expect(getterCalls).toBe(0);

    const hiddenOptions = {};
    Object.defineProperty(hiddenOptions, 'maxUtf8Bytes', {
      enumerable: false,
      value: 1024,
    });
    expectInvalidOptions(hiddenOptions);
  });

  it('redacts option reflection failures before serialization', () => {
    const hostileOptions = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('private reflection detail');
        },
      },
    );

    expectInvalidOptions(hostileOptions);
  });

  it('preserves omitted, empty, and exact data-property options', () => {
    expect(encodeDocumentEnvelope(ENVELOPE).byteLength).toBeGreaterThan(0);
    expect(encodeDocumentEnvelope(ENVELOPE, {}).byteLength).toBeGreaterThan(0);
    expect(
      encodeDocumentEnvelope(ENVELOPE, {
        maxUtf8Bytes: 1024,
      }).byteLength,
    ).toBeGreaterThan(0);
  });
});
