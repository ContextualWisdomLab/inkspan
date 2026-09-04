import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDocumentEnvelope } from '../documentEnvelope.js';
import {
  createDocumentEnvelopeRevision,
  type CwlEditorDocumentRevision,
  type DocumentEnvelopeDigestProvider,
} from '../documentEnvelopeRevision.js';
import * as reviewModule from './index.js';

interface ReviewRevisionGuardSurface {
  readonly assertReviewSuggestionCurrentRevision: (
    suggestion: unknown,
    currentSource: unknown,
    limits?: unknown,
    digestProvider?: DocumentEnvelopeDigestProvider | null,
  ) => Promise<unknown>;
}

function revisionGuardSurface(): ReviewRevisionGuardSurface {
  return reviewModule as unknown as ReviewRevisionGuardSurface;
}

function toBytes(source: BufferSource): Uint8Array {
  return ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
}

function sha256(source: BufferSource): ArrayBuffer {
  const digest = createHash('sha256').update(toBytes(source)).digest();
  const result = new Uint8Array(32);
  result.set(digest);
  return result.buffer;
}

function digestProvider(): DocumentEnvelopeDigestProvider {
  return {
    async digest(algorithm, source) {
      expect(algorithm).toBe('SHA-256');
      return sha256(source);
    },
  };
}

function insertSuggestion(revision: CwlEditorDocumentRevision) {
  return {
    contractVersion: 1,
    kind: 'insert',
    target: {
      contractVersion: 1,
      revision,
      selector: {
        type: 'TextPositionSelector',
        start: 0,
        end: 0,
      },
      projection: {
        id: 'inkspan-prosemirror-text',
        version: 1,
      },
    },
    text: 'private proposal text',
  };
}

const CURRENT_DOCUMENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'private current body' }],
    },
  ],
};

describe('review suggestion mutation-boundary revision guard', () => {
  it('returns only a detached validated suggestion when its target matches the exact current revision', async () => {
    const provider = digestProvider();
    const currentEnvelope = createDocumentEnvelope(CURRENT_DOCUMENT);
    const currentRevision = await createDocumentEnvelopeRevision(
      currentEnvelope,
      undefined,
      provider,
    );

    const admitted = (await revisionGuardSurface().assertReviewSuggestionCurrentRevision(
      insertSuggestion(currentRevision),
      currentEnvelope,
      undefined,
      provider,
    )) as {
      readonly kind: 'insert';
      readonly text: string;
      readonly target: { readonly revision: CwlEditorDocumentRevision };
    };

    expect(admitted.kind).toBe('insert');
    expect(admitted.text).toBe('private proposal text');
    expect(admitted.target.revision).toEqual(currentRevision);
    expect(Object.isFrozen(admitted)).toBe(true);
    expect(Object.isFrozen(admitted.target)).toBe(true);
    expect(JSON.stringify(admitted)).not.toContain('private current body');
  });

  it('fails closed before mutation when the proposal targets any other document revision', async () => {
    const provider = digestProvider();
    const currentEnvelope = createDocumentEnvelope(CURRENT_DOCUMENT);
    const staleDigest = 'f'.repeat(64);
    const staleRevision = Object.freeze({
      algorithm: 'SHA-256' as const,
      digestHex: staleDigest,
      strongEntityTag: `"sha256-${staleDigest}"`,
    });

    await expect(
      revisionGuardSurface().assertReviewSuggestionCurrentRevision(
        insertSuggestion(staleRevision),
        currentEnvelope,
        undefined,
        provider,
      ),
    ).rejects.toMatchObject({
      name: 'CwlReviewOperationError',
      code: 'stale_operation',
      message: 'Review operation targets a stale document revision.',
    });
  });
});
