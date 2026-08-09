import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DocumentEnvelopeError,
  parseDocumentEnvelope,
} from './documentEnvelope.js';
import {
  inspectDocumentEnvelopeIdentity,
  inspectDocumentEnvelopeIdentityBytes,
} from './documentEnvelopeIdentity.js';

const legacyEnvelope = {
  schemaId: 'https://inkspan.io/schemas/document-envelope/v0',
  schemaVersion: 7,
  documentJson: { legacyShape: ['tenant-secret-text'] },
};

describe('document envelope identity inspection', () => {
  it('identifies unsupported envelopes without weakening strict parsing', () => {
    const identity = inspectDocumentEnvelopeIdentity(legacyEnvelope);

    expect(identity).toEqual({
      schemaId: legacyEnvelope.schemaId,
      schemaVersion: legacyEnvelope.schemaVersion,
    });
    expect(Object.isFrozen(identity)).toBe(true);
    expect(() => parseDocumentEnvelope(legacyEnvelope)).toThrow(
      'schema is unsupported',
    );
    expect(JSON.stringify(identity)).not.toContain('tenant-secret-text');
  });

  it('accepts complete JSON text with future top-level data but returns routing metadata only', () => {
    const source = JSON.stringify({
      ...legacyEnvelope,
      futureRoutingHint: { ignored: true },
    });

    expect(inspectDocumentEnvelopeIdentity(source)).toEqual({
      schemaId: legacyEnvelope.schemaId,
      schemaVersion: 7,
    });
  });

  it('accepts strict UTF-8 bytes including Buffer subclasses', () => {
    const bytes = Buffer.from(JSON.stringify(legacyEnvelope), 'utf8');

    expect(inspectDocumentEnvelopeIdentityBytes(bytes)).toEqual({
      schemaId: legacyEnvelope.schemaId,
      schemaVersion: 7,
    });
  });

  it.each([false, true, 1.5, 0, -1, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid schemaVersion %s',
    (schemaVersion) => {
      expect(() =>
        inspectDocumentEnvelopeIdentity({
          ...legacyEnvelope,
          schemaVersion,
        }),
      ).toThrow(DocumentEnvelopeError);
    },
  );

  it('requires schemaId and documentJson but does not require the current document schema', () => {
    expect(() =>
      inspectDocumentEnvelopeIdentity({
        schemaVersion: 1,
        documentJson: {},
      }),
    ).toThrow(DocumentEnvelopeError);
    expect(() =>
      inspectDocumentEnvelopeIdentity({
        schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
        schemaVersion: 1,
      }),
    ).toThrow(DocumentEnvelopeError);

    expect(
      inspectDocumentEnvelopeIdentity({
        schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
        schemaVersion: 1,
        documentJson: { not: 'a ProseMirror doc root' },
      }),
    ).toEqual({
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: 1,
    });
  });

  it('rejects duplicate names and malformed JSON without reflecting source content', () => {
    const duplicate =
      '{"schemaId":"first-secret","schemaId":"second-secret","schemaVersion":1,"documentJson":{}}';
    const malformed = '{"schemaId":"tenant-secret"';

    for (const source of [duplicate, malformed]) {
      try {
        inspectDocumentEnvelopeIdentity(source);
        throw new Error('expected identity inspection to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(DocumentEnvelopeError);
        expect(String(error)).not.toContain('first-secret');
        expect(String(error)).not.toContain('second-secret');
        expect(String(error)).not.toContain('tenant-secret');
      }
    }
  });

  it('does not invoke envelope accessors and redacts hostile reflection failures', () => {
    let getterCalled = false;
    const accessorEnvelope: Record<string, unknown> = {
      schemaId: 'legacy',
      schemaVersion: 2,
      documentJson: {},
    };
    Object.defineProperty(accessorEnvelope, 'futureField', {
      enumerable: true,
      get() {
        getterCalled = true;
        throw new Error('tenant-secret');
      },
    });

    expect(() => inspectDocumentEnvelopeIdentity(accessorEnvelope)).toThrow(
      DocumentEnvelopeError,
    );
    expect(getterCalled).toBe(false);

    const hostile = new Proxy(legacyEnvelope, {
      ownKeys() {
        throw new Error('tenant-secret');
      },
    });
    try {
      inspectDocumentEnvelopeIdentity(hostile);
      throw new Error('expected hostile proxy to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentEnvelopeError);
      expect(String(error)).not.toContain('tenant-secret');
    }
  });

  it('reuses document resource ceilings without interpreting current-schema semantics', () => {
    expect(() =>
      inspectDocumentEnvelopeIdentity(legacyEnvelope, {
        maxJsonValues: 1,
      }),
    ).toThrow('JSON value count');

    expect(() =>
      inspectDocumentEnvelopeIdentity(legacyEnvelope, {
        maxStringCodeUnits: 5,
      }),
    ).toThrow('strings exceed');

    expect(() =>
      inspectDocumentEnvelopeIdentity(
        {
          ...legacyEnvelope,
          documentJson: { nested: { too: { deep: true } } },
        },
        { maxNestingDepth: 1 },
      ),
    ).toThrow('nesting');
  });

  it('rejects BOM and invalid UTF-8 bytes', () => {
    expect(() =>
      inspectDocumentEnvelopeIdentityBytes(
        new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]),
      ),
    ).toThrow('byte-order mark');
    expect(() =>
      inspectDocumentEnvelopeIdentityBytes(new Uint8Array([0xff])),
    ).toThrow('valid UTF-8');
  });
});
