import { describe, expect, it } from 'vitest';

import {
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
} from '../documentEnvelope.js';
import type { CwlEditorDocumentRevision } from '../documentEnvelopeRevision.js';
import {
  applyReviewSuggestionToTextProjection,
  createReviewOperationResult,
  DEFAULT_REVIEW_LIMITS,
  REVIEW_CONTRACT_SCHEMA_ID,
  REVIEW_CONTRACT_SCHEMA_VERSION,
  ReviewContractError,
  validateReviewSuggestion,
  validateReviewTarget,
  validateReviewThread,
} from './contract.js';

function revision(fill: number): CwlEditorDocumentRevision {
  const digestHex = fill.toString(16).padStart(2, '0').repeat(32);
  return Object.freeze({
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  });
}

function target(start: number, end: number, current = revision(1)) {
  return {
    revision: current,
    selector: { type: 'TextPositionSelector' as const, start, end },
    textProjection: { id: 'inkspan-prosemirror-text' as const, version: 1 as const },
  };
}

function insertSuggestion(
  start: number,
  end: number,
  text = 'new',
  current = revision(1),
  state: 'pending' | 'accepted' | 'rejected' = 'pending',
) {
  return {
    suggestionId: 'suggestion-1',
    kind: 'insert' as const,
    state,
    expectedRevision: current,
    target: target(start, end, current),
    text,
  };
}

function deleteSuggestion(
  start: number,
  end: number,
  current = revision(1),
) {
  return {
    suggestionId: 'suggestion-1',
    kind: 'delete' as const,
    state: 'pending' as const,
    expectedRevision: current,
    target: target(start, end, current),
  };
}

function envelope(reviewed = false) {
  return {
    schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
    schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
    documentJson: reviewed
      ? { type: 'doc', attrs: { reviewed: true } }
      : { type: 'doc' },
  } as const;
}

function sequenceProvider(...fills: number[]) {
  let index = 0;
  return {
    async digest() {
      const fill = fills[index++];
      if (fill === undefined) throw new Error('digest sequence exhausted');
      return new Uint8Array(32).fill(fill).buffer;
    },
  };
}

describe('provider-neutral review contract', () => {
  it('exports bounded schema identity and validates frozen target/thread metadata', () => {
    expect(REVIEW_CONTRACT_SCHEMA_ID).toBe('https://inkspan.io/schemas/review/v1');
    expect(REVIEW_CONTRACT_SCHEMA_VERSION).toBe(1);
    expect(DEFAULT_REVIEW_LIMITS.maxThreadCount).toBe(10_000);

    const validatedTarget = validateReviewTarget(target(1, 2));
    expect(Object.isFrozen(validatedTarget)).toBe(true);
    expect(Object.isFrozen(validatedTarget.revision)).toBe(true);
    expect(Object.isFrozen(validatedTarget.selector)).toBe(true);
    expect(Object.isFrozen(validatedTarget.textProjection)).toBe(true);

    const thread = validateReviewThread({
      threadId: 'thread-1',
      target: target(1, 2),
      state: 'open',
      replyCount: 2,
    });
    expect(thread).toMatchObject({
      threadId: 'thread-1',
      state: 'open',
      replyCount: 2,
    });
    expect(Object.isFrozen(thread)).toBe(true);
  });

  it('rejects malformed, accessor-backed, unsupported, and over-limit metadata', () => {
    expect(() => validateReviewTarget(null)).toThrowError(
      new ReviewContractError('invalid_review_contract'),
    );
    expect(() =>
      validateReviewTarget({
        ...target(0, 0),
        revision: { ...revision(1), digestHex: 'not-a-digest' },
      }),
    ).toThrowError(new ReviewContractError('invalid_review_contract'));
    const customPrototype = Object.create({ inherited: true }) as Record<
      string,
      unknown
    >;
    Object.assign(customPrototype, target(0, 0));
    expect(() => validateReviewTarget(customPrototype)).toThrowError(
      new ReviewContractError('invalid_review_contract'),
    );
    const throwingPrototype = new Proxy(
      {},
      { getPrototypeOf: () => { throw new Error('untrusted input'); } },
    );
    expect(() => validateReviewTarget(throwingPrototype)).toThrowError(
      new ReviewContractError('invalid_review_contract'),
    );
    expect(() => validateReviewTarget({ ...target(2, 1) })).toThrowError(
      new ReviewContractError('invalid_review_contract'),
    );
    expect(() =>
      validateReviewTarget({
        ...target(0, 0),
        textProjection: { id: 'other', version: 1 },
      }),
    ).toThrowError(new ReviewContractError('unsupported_projection'));

    const accessorTarget = {} as Record<string, unknown>;
    Object.defineProperty(accessorTarget, 'revision', {
      get: () => target(0, 0).revision,
    });
    expect(() => validateReviewTarget(accessorTarget)).toThrowError(
      new ReviewContractError('invalid_review_contract'),
    );

    expect(() =>
      validateReviewThread({
        threadId: '',
        target: target(0, 0),
        state: 'open',
        replyCount: 0,
      }),
    ).toThrowError(new ReviewContractError('invalid_review_contract'));
    expect(() =>
      validateReviewThread({
        threadId: 'thread-1',
        target: target(0, 0),
        state: 'other',
        replyCount: 0,
      }),
    ).toThrowError(new ReviewContractError('invalid_review_contract'));
    expect(() =>
      validateReviewThread(
        {
          threadId: 'thread-1',
          target: target(0, 0),
          state: 'resolved',
          replyCount: 10_001,
        },
        { ...DEFAULT_REVIEW_LIMITS, maxReplyCount: 10_000 },
      ),
    ).toThrowError(new ReviewContractError('invalid_review_contract'));
  });

  it('validates insert/delete records and rejects ambiguous suggestion shapes', () => {
    expect(validateReviewSuggestion(insertSuggestion(2, 2))).toMatchObject({
      kind: 'insert',
      text: 'new',
    });
    expect(validateReviewSuggestion(deleteSuggestion(1, 3))).toMatchObject({
      kind: 'delete',
    });
    expect(
      validateReviewSuggestion(insertSuggestion(0, 0, 'x', revision(1), 'accepted')),
    ).toMatchObject({ state: 'accepted' });
    expect(
      validateReviewSuggestion(insertSuggestion(0, 0, 'x', revision(1), 'rejected')),
    ).toMatchObject({ state: 'rejected' });

    expect(() => validateReviewSuggestion(insertSuggestion(0, 1))).toThrowError(
      new ReviewContractError('invalid_review_contract'),
    );
    expect(() => validateReviewSuggestion(insertSuggestion(0, 0, ''))).toThrowError(
      new ReviewContractError('invalid_review_contract'),
    );
    expect(() => validateReviewSuggestion(deleteSuggestion(1, 1))).toThrowError(
      new ReviewContractError('invalid_review_contract'),
    );
    expect(() =>
      validateReviewSuggestion({
        ...deleteSuggestion(1, 2),
        kind: 'unknown',
      }),
    ).toThrowError(new ReviewContractError('invalid_review_contract'));
    expect(() =>
      validateReviewSuggestion({
        ...deleteSuggestion(1, 2),
        target: target(1, 2, revision(2)),
      }),
    ).toThrowError(new ReviewContractError('invalid_review_contract'));
    expect(() =>
      validateReviewSuggestion({
        ...insertSuggestion(0, 0),
        text: 'x'.repeat(DEFAULT_REVIEW_LIMITS.maxSuggestionTextCodeUnits + 1),
      }),
    ).toThrowError(new ReviewContractError('invalid_review_contract'));
  });

  it('applies Unicode-code-point insert/delete operations and fails closed', () => {
    const current = revision(1);
    expect(
      applyReviewSuggestionToTextProjection(
        'A😀B',
        current,
        insertSuggestion(1, 1, 'x', current),
      ),
    ).toBe('Ax😀B');
    expect(
      applyReviewSuggestionToTextProjection(
        'A😀B',
        current,
        deleteSuggestion(1, 2, current),
      ),
    ).toBe('AB');
    expect(
      applyReviewSuggestionToTextProjection(
        'A😀B',
        current,
        insertSuggestion(1, 1, 'x', current),
        'reject',
      ),
    ).toBe('A😀B');
    expect(() =>
      applyReviewSuggestionToTextProjection(
        'A',
        current,
        insertSuggestion(0, 0, 'x', current),
        'other' as 'accept',
      ),
    ).toThrowError(new ReviewContractError('invalid_review_contract'));
    expect(() =>
      applyReviewSuggestionToTextProjection(
        'A',
        revision(2),
        insertSuggestion(0, 0, 'x'),
      ),
    ).toThrowError(new ReviewContractError('stale_revision'));
    expect(() =>
      applyReviewSuggestionToTextProjection(
        'A',
        current,
        insertSuggestion(4, 4, 'x'),
      ),
    ).toThrowError(new ReviewContractError('selector_out_of_range'));
    expect(() =>
      applyReviewSuggestionToTextProjection(
        'A',
        current,
        insertSuggestion(0, 0, 'x', current, 'accepted'),
      ),
    ).toThrowError(new ReviewContractError('operation_already_final'));
  });

  it('returns exact accepted, rejected, and stale transition results without bodies', async () => {
    await expect(
      createReviewOperationResult(
        {
          suggestion: insertSuggestion(0, 0),
          action: 'other' as 'accept',
        },
        envelope(),
        envelope(true),
      ),
    ).rejects.toThrowError(new ReviewContractError('invalid_review_contract'));
    await expect(
      createReviewOperationResult(
        {
          suggestion: insertSuggestion(0, 0, 'x', revision(1), 'accepted'),
          action: 'accept',
        },
        envelope(),
        envelope(true),
      ),
    ).rejects.toThrowError(new ReviewContractError('operation_already_final'));
    const accepted = await createReviewOperationResult(
      { suggestion: insertSuggestion(0, 0), action: 'accept' },
      envelope(),
      envelope(true),
      undefined,
      sequenceProvider(1, 2),
    );
    expect(accepted).toMatchObject({
      schemaId: REVIEW_CONTRACT_SCHEMA_ID,
      schemaVersion: REVIEW_CONTRACT_SCHEMA_VERSION,
      status: 'accepted',
      action: 'accept',
      beforeRevision: revision(1),
      resultingRevision: revision(2),
    });
    expect(accepted.transitionEvidence?.changed).toBe(true);
    expect(accepted).not.toHaveProperty('documentJson');

    const rejected = await createReviewOperationResult(
      { suggestion: deleteSuggestion(1, 2), action: 'reject' },
      envelope(),
      envelope(),
      undefined,
      sequenceProvider(1, 1),
    );
    expect(rejected.status).toBe('rejected');
    expect(rejected.transitionEvidence?.changed).toBe(false);

    const stale = await createReviewOperationResult(
      { suggestion: insertSuggestion(0, 0, 'x', revision(9)), action: 'accept' },
      envelope(),
      envelope(true),
      undefined,
      sequenceProvider(1, 2),
    );
    expect(stale).toMatchObject({ status: 'stale', beforeRevision: revision(1) });
    expect(stale).not.toHaveProperty('transitionEvidence');

    await expect(
      createReviewOperationResult(
        { suggestion: insertSuggestion(0, 0, 'x', revision(1)), action: 'accept' },
        envelope(),
        envelope(),
        undefined,
        sequenceProvider(1, 1),
      ),
    ).rejects.toThrowError(new ReviewContractError('operation_must_change_document'));
    await expect(
      createReviewOperationResult(
        { suggestion: deleteSuggestion(1, 2), action: 'reject' },
        envelope(),
        envelope(true),
        undefined,
        sequenceProvider(1, 2),
      ),
    ).rejects.toThrowError(
      new ReviewContractError('rejected_operation_changed_document'),
    );
  });
});
