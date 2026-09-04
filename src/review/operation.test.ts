import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDocumentEnvelope } from '../documentEnvelope.js';
import {
  createDocumentEnvelopeRevision,
  type CwlEditorDocumentRevision,
  type DocumentEnvelopeDigestProvider,
} from '../documentEnvelopeRevision.js';
import * as reviewModule from './index.js';

interface ReviewOperationSurface {
  readonly CwlReviewOperationError: new (
    code:
      | 'invalid_operation'
      | 'stale_operation_changed'
      | 'accepted_operation_unchanged'
      | 'rejected_operation_changed',
  ) => Error & {
    readonly code:
      | 'invalid_operation'
      | 'stale_operation_changed'
      | 'accepted_operation_unchanged'
      | 'rejected_operation_changed';
  };
  readonly createReviewOperationResult: (
    suggestion: unknown,
    action: 'accept' | 'reject',
    previousSource: unknown,
    resultingSource: unknown,
    limits?: unknown,
    digestProvider?: DocumentEnvelopeDigestProvider | null,
  ) => Promise<unknown>;
}

function reviewOperationSurface(): ReviewOperationSurface {
  return reviewModule as unknown as ReviewOperationSurface;
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

function target(revision: CwlEditorDocumentRevision) {
  return {
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
  };
}

function insertSuggestion(revision: CwlEditorDocumentRevision) {
  return {
    contractVersion: 1,
    kind: 'insert',
    target: target(revision),
    text: '검토 제안',
  };
}

const BEFORE_DOCUMENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'private before body' }],
    },
  ],
};
const AFTER_DOCUMENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'private after body' }],
    },
  ],
};

describe('provider-neutral review operation evidence', () => {
  it('binds an accepted proposal to exact before/after revisions without retaining document bodies', async () => {
    const provider = digestProvider();
    const previousEnvelope = createDocumentEnvelope(BEFORE_DOCUMENT);
    const resultingEnvelope = createDocumentEnvelope(AFTER_DOCUMENT);
    const expectedRevision = await createDocumentEnvelopeRevision(
      previousEnvelope,
      undefined,
      provider,
    );

    const result = (await reviewOperationSurface().createReviewOperationResult(
      insertSuggestion(expectedRevision),
      'accept',
      previousEnvelope,
      resultingEnvelope,
      undefined,
      provider,
    )) as {
      readonly contractVersion: 1;
      readonly action: 'accept';
      readonly status: 'accepted';
      readonly beforeRevision: CwlEditorDocumentRevision;
      readonly resultingRevision: CwlEditorDocumentRevision;
      readonly transitionEvidence: {
        readonly previousRevision: CwlEditorDocumentRevision;
        readonly resultingRevision: CwlEditorDocumentRevision;
        readonly changed: boolean;
      };
    };

    expect(result.contractVersion).toBe(1);
    expect(result.action).toBe('accept');
    expect(result.status).toBe('accepted');
    expect(result.beforeRevision).toEqual(expectedRevision);
    expect(result.resultingRevision).not.toEqual(expectedRevision);
    expect(result.transitionEvidence).toMatchObject({
      previousRevision: expectedRevision,
      changed: true,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private before body');
    expect(JSON.stringify(result)).not.toContain('private after body');
    expect(JSON.stringify(result)).not.toContain('검토 제안');
  });

  it('returns a stable stale result only when a mismatched target leaves the document unchanged', async () => {
    const provider = digestProvider();
    const previousEnvelope = createDocumentEnvelope(BEFORE_DOCUMENT);
    const staleDigest = 'f'.repeat(64);
    const staleRevision = Object.freeze({
      algorithm: 'SHA-256' as const,
      digestHex: staleDigest,
      strongEntityTag: `"sha256-${staleDigest}"`,
    });

    const result = (await reviewOperationSurface().createReviewOperationResult(
      insertSuggestion(staleRevision),
      'accept',
      previousEnvelope,
      previousEnvelope,
      undefined,
      provider,
    )) as Record<string, unknown>;

    expect(result.status).toBe('stale');
    expect(result.action).toBe('accept');
    expect(result.beforeRevision).not.toEqual(staleRevision);
    expect(result).not.toHaveProperty('resultingRevision');
    expect(result).not.toHaveProperty('transitionEvidence');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('fails closed when a stale proposal is reported with a changed resulting document', async () => {
    const provider = digestProvider();
    const previousEnvelope = createDocumentEnvelope(BEFORE_DOCUMENT);
    const resultingEnvelope = createDocumentEnvelope(AFTER_DOCUMENT);
    const staleDigest = 'f'.repeat(64);
    const staleRevision = Object.freeze({
      algorithm: 'SHA-256' as const,
      digestHex: staleDigest,
      strongEntityTag: `"sha256-${staleDigest}"`,
    });

    await expect(
      reviewOperationSurface().createReviewOperationResult(
        insertSuggestion(staleRevision),
        'accept',
        previousEnvelope,
        resultingEnvelope,
        undefined,
        provider,
      ),
    ).rejects.toMatchObject({
      name: 'CwlReviewOperationError',
      code: 'stale_operation_changed',
      message: 'Stale review operations must not change the document.',
    });
  });

  it('requires accepted operations to change the document and rejected operations to preserve it', async () => {
    const provider = digestProvider();
    const previousEnvelope = createDocumentEnvelope(BEFORE_DOCUMENT);
    const resultingEnvelope = createDocumentEnvelope(AFTER_DOCUMENT);
    const expectedRevision = await createDocumentEnvelopeRevision(
      previousEnvelope,
      undefined,
      provider,
    );
    const suggestion = insertSuggestion(expectedRevision);
    const { createReviewOperationResult, CwlReviewOperationError } =
      reviewOperationSurface();

    await expect(
      createReviewOperationResult(
        suggestion,
        'accept',
        previousEnvelope,
        previousEnvelope,
        undefined,
        provider,
      ),
    ).rejects.toMatchObject({
      code: 'accepted_operation_unchanged',
    });
    await expect(
      createReviewOperationResult(
        suggestion,
        'reject',
        previousEnvelope,
        resultingEnvelope,
        undefined,
        provider,
      ),
    ).rejects.toMatchObject({
      code: 'rejected_operation_changed',
    });

    const dynamicOperation = createReviewOperationResult as unknown as (
      suggestion: unknown,
      action: unknown,
      previousSource: unknown,
      resultingSource: unknown,
      limits?: unknown,
      digestProvider?: DocumentEnvelopeDigestProvider | null,
    ) => Promise<unknown>;
    await expect(
      dynamicOperation(
        suggestion,
        'approve',
        previousEnvelope,
        resultingEnvelope,
        undefined,
        provider,
      ),
    ).rejects.toMatchObject({ code: 'invalid_operation' });

    const failure = new CwlReviewOperationError('invalid_operation');
    expect(failure.message).not.toContain('private before body');
    expect(failure.message).not.toContain('검토 제안');
  });

  it('returns a frozen rejected result for an unchanged exact-revision operation', async () => {
    const provider = digestProvider();
    const previousEnvelope = createDocumentEnvelope(BEFORE_DOCUMENT);
    const expectedRevision = await createDocumentEnvelopeRevision(
      previousEnvelope,
      undefined,
      provider,
    );

    const result = (await reviewOperationSurface().createReviewOperationResult(
      insertSuggestion(expectedRevision),
      'reject',
      previousEnvelope,
      previousEnvelope,
      undefined,
      provider,
    )) as {
      readonly status: 'rejected';
      readonly transitionEvidence: { readonly changed: boolean };
    };

    expect(result.status).toBe('rejected');
    expect(result.transitionEvidence.changed).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
