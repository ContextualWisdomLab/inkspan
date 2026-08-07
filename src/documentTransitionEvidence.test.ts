import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentEnvelope,
  type CwlEditorDocumentEnvelope,
} from './documentEnvelope.js';
import { encodeDocumentEnvelope } from './documentEnvelopeCanonical.js';
import type { DocumentEnvelopeDigestProvider } from './documentEnvelopeRevision.js';
import {
  DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID,
  DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION,
  createDocumentEnvelopeTransitionEvidence,
  createDocumentEnvelopeTransitionEvidenceBytes,
} from './documentTransitionEvidence.js';

const PREVIOUS_DIGEST =
  '3fa1c51896f050a33553ac05879bf85f' +
  '1fd79a501bb7a2c6828b8dcb9b93c5d0';
const RESULTING_DIGEST =
  '86a66355c6504b139562e59a3e6a3fef' +
  '4544f064041afce15709a318192b3f26';

const PREVIOUS_DOCUMENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Confidential author text' }],
    },
  ],
};
const RESULTING_DOCUMENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Reviewed author text' }],
    },
  ],
};

/** Copy any digest input into a detached byte view. */
function toBytes(source: BufferSource): Uint8Array {
  return ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
}

/** Return a detached SHA-256 buffer for one canonical byte sequence. */
function sha256(source: BufferSource): ArrayBuffer {
  const digest = createHash('sha256').update(toBytes(source)).digest();
  const result = new Uint8Array(32);
  result.set(digest);
  return result.buffer;
}

/** Create a production-equivalent SHA-256 provider for known-answer tests. */
function createNativeSha256Provider(): DocumentEnvelopeDigestProvider {
  return {
    async digest(algorithm, source) {
      expect(algorithm).toBe('SHA-256');
      return sha256(source);
    },
  };
}

/** Recursively collect every enumerable object key exposed by public evidence. */
function collectKeys(source: unknown, result = new Set<string>()): Set<string> {
  if (source === null || typeof source !== 'object') return result;
  for (const [key, value] of Object.entries(source)) {
    result.add(key);
    collectKeys(value, result);
  }
  return result;
}

/** Produce noncanonical JSON text for a valid normalized envelope. */
function noncanonicalEnvelopeJson(
  envelope: CwlEditorDocumentEnvelope,
): string {
  return JSON.stringify(
    {
      schemaVersion: envelope.schemaVersion,
      documentJson: envelope.documentJson,
      schemaId: envelope.schemaId,
    },
    null,
    2,
  );
}

describe('document transition evidence', () => {
  it('binds realistic before-and-after documents to known revisions without leaking content', async () => {
    const previousEnvelope = createDocumentEnvelope(PREVIOUS_DOCUMENT);
    const resultingEnvelope = createDocumentEnvelope(RESULTING_DOCUMENT);

    const evidence = await createDocumentEnvelopeTransitionEvidence(
      previousEnvelope,
      resultingEnvelope,
      undefined,
      createNativeSha256Provider(),
    );

    expect(DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID).toBe(
      'https://inkspan.io/schemas/document-transition-evidence/v1',
    );
    expect(DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION).toBe(1);
    expect(evidence).toEqual({
      schemaId: DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID,
      schemaVersion: DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION,
      previousRevision: {
        algorithm: 'SHA-256',
        digestHex: PREVIOUS_DIGEST,
        strongEntityTag: `"sha256-${PREVIOUS_DIGEST}"`,
      },
      resultingRevision: {
        algorithm: 'SHA-256',
        digestHex: RESULTING_DIGEST,
        strongEntityTag: `"sha256-${RESULTING_DIGEST}"`,
      },
      changed: true,
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.previousRevision)).toBe(true);
    expect(Object.isFrozen(evidence.resultingRevision)).toBe(true);
    expect(JSON.stringify(evidence)).not.toContain('Confidential author text');
    expect(JSON.stringify(evidence)).not.toContain('Reviewed author text');

    const exposedKeys = collectKeys(evidence);
    for (const forbiddenKey of [
      'envelope',
      'documentJson',
      'text',
      'href',
      'alt',
      'src',
    ]) {
      expect(exposedKeys.has(forbiddenKey)).toBe(false);
    }
  });

  it('parses both sources before hashing and returns no partial evidence', async () => {
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async () => new ArrayBuffer(32)),
    };

    await expect(
      createDocumentEnvelopeTransitionEvidence(
        createDocumentEnvelope(PREVIOUS_DOCUMENT),
        {
          schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
          schemaVersion: 2,
          documentJson: RESULTING_DOCUMENT,
        },
        undefined,
        digestProvider,
      ),
    ).rejects.toThrow();

    expect(digestProvider.digest).not.toHaveBeenCalled();
  });

  it('hashes previous then resulting canonical bytes without overlapping provider calls', async () => {
    const previousEnvelope = createDocumentEnvelope(PREVIOUS_DOCUMENT);
    const resultingEnvelope = createDocumentEnvelope(RESULTING_DOCUMENT);
    const digestInputs: Uint8Array[] = [];
    let activeCalls = 0;
    let maximumConcurrentCalls = 0;
    const digestProvider: DocumentEnvelopeDigestProvider = {
      async digest(algorithm, source) {
        expect(algorithm).toBe('SHA-256');
        activeCalls += 1;
        maximumConcurrentCalls = Math.max(
          maximumConcurrentCalls,
          activeCalls,
        );
        digestInputs.push(new Uint8Array(toBytes(source)));
        await Promise.resolve();
        activeCalls -= 1;
        return sha256(source);
      },
    };

    const evidence = await createDocumentEnvelopeTransitionEvidence(
      previousEnvelope,
      resultingEnvelope,
      undefined,
      digestProvider,
    );

    expect(evidence.changed).toBe(true);
    expect(maximumConcurrentCalls).toBe(1);
    expect(digestInputs.map((input) => Array.from(input))).toEqual([
      Array.from(encodeDocumentEnvelope(previousEnvelope)),
      Array.from(encodeDocumentEnvelope(resultingEnvelope)),
    ]);
  });

  it('classifies equivalent object sources as unchanged', async () => {
    const envelope = createDocumentEnvelope(PREVIOUS_DOCUMENT);
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (_algorithm, source) => sha256(source)),
    };

    const evidence = await createDocumentEnvelopeTransitionEvidence(
      envelope,
      noncanonicalEnvelopeJson(envelope),
      undefined,
      digestProvider,
    );

    expect(evidence.changed).toBe(false);
    expect(evidence.previousRevision).toEqual(evidence.resultingRevision);
    expect(digestProvider.digest).toHaveBeenCalledTimes(2);
  });

  it('normalizes strict UTF-8 sources through the same transition contract', async () => {
    const previousEnvelope = createDocumentEnvelope(PREVIOUS_DOCUMENT);
    const resultingEnvelope = createDocumentEnvelope(RESULTING_DOCUMENT);
    const objectEvidence = await createDocumentEnvelopeTransitionEvidence(
      previousEnvelope,
      resultingEnvelope,
      undefined,
      createNativeSha256Provider(),
    );

    const byteEvidence = await createDocumentEnvelopeTransitionEvidenceBytes(
      new TextEncoder().encode(noncanonicalEnvelopeJson(previousEnvelope)),
      new TextEncoder().encode(noncanonicalEnvelopeJson(resultingEnvelope)),
      undefined,
      createNativeSha256Provider(),
    );

    expect(byteEvidence).toEqual(objectEvidence);
    expect(Object.isFrozen(byteEvidence)).toBe(true);
  });
});
