import { describe, expect, it, vi } from 'vitest';
import { createDocumentEnvelope } from './documentEnvelope.js';
import { encodeDocumentEnvelope } from './documentEnvelopeCanonical.js';
import type { DocumentEnvelopeDigestProvider } from './documentEnvelopeRevision.js';
import {
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
} from './documentRevisionEvidence.js';

const DOCUMENT_JSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Portable evidence' }],
    },
  ],
};

function toBytes(source: BufferSource): Uint8Array {
  return ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
}

function createDigestBuffer(fill: number): ArrayBuffer {
  const buffer = new ArrayBuffer(32);
  new Uint8Array(buffer).fill(fill);
  return buffer;
}

describe('pure document revision evidence', () => {
  it('returns the exact frozen normalized envelope whose canonical bytes were hashed', async () => {
    const envelope = createDocumentEnvelope(DOCUMENT_JSON);
    let receivedBytes: Uint8Array | undefined;
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (_algorithm, source) => {
        receivedBytes = new Uint8Array(toBytes(source));
        return createDigestBuffer(0xab);
      }),
    };
    const reorderedJson = JSON.stringify({
      schemaVersion: envelope.schemaVersion,
      documentJson: envelope.documentJson,
      schemaId: envelope.schemaId,
    });

    const evidence = await createDocumentEnvelopeRevisionEvidence(
      reorderedJson,
      undefined,
      digestProvider,
    );

    expect(evidence.envelope).toEqual(envelope);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.envelope)).toBe(true);
    expect(Object.isFrozen(evidence.envelope.documentJson)).toBe(true);
    expect(Object.isFrozen(evidence.revision)).toBe(true);
    expect(Array.from(receivedBytes ?? [])).toEqual(
      Array.from(encodeDocumentEnvelope(evidence.envelope)),
    );
    expect(evidence.revision.digestHex).toBe('ab'.repeat(32));
    expect(digestProvider.digest).toHaveBeenCalledOnce();
  });

  it('normalizes noncanonical strict UTF-8 bytes before returning evidence', async () => {
    const envelope = createDocumentEnvelope(DOCUMENT_JSON);
    const noncanonicalBytes = new TextEncoder().encode(
      JSON.stringify(
        {
          schemaVersion: envelope.schemaVersion,
          documentJson: envelope.documentJson,
          schemaId: envelope.schemaId,
        },
        null,
        2,
      ),
    );
    let receivedBytes: Uint8Array | undefined;
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (_algorithm, source) => {
        receivedBytes = new Uint8Array(toBytes(source));
        return createDigestBuffer(0xcd);
      }),
    };

    const evidence = await createDocumentEnvelopeRevisionEvidenceBytes(
      noncanonicalBytes,
      undefined,
      digestProvider,
    );

    expect(evidence.envelope).toEqual(envelope);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.envelope)).toBe(true);
    expect(Object.isFrozen(evidence.revision)).toBe(true);
    expect(Array.from(receivedBytes ?? [])).toEqual(
      Array.from(encodeDocumentEnvelope(evidence.envelope)),
    );
    expect(evidence.revision.digestHex).toBe('cd'.repeat(32));
    expect(digestProvider.digest).toHaveBeenCalledOnce();
  });
});
