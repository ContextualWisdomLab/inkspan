import type {
  CwlEditorDocumentEnvelope,
  DocumentEnvelopeLimits,
} from '../documentEnvelope.js';
import {
  type CwlEditorDocumentRevision,
  type DocumentEnvelopeDigestProvider,
} from '../documentEnvelopeRevision.js';
import { createDocumentEnvelopeTransitionEvidence } from '../documentTransitionEvidence.js';
import type {
  CwlEditorTextPositionSelector,
  CwlEditorTextProjectionIdentity,
} from '../textPositionSelectorEvidence.js';

/** Stable identifier for the first provider-neutral review contract. */
export const REVIEW_CONTRACT_SCHEMA_ID =
  'https://inkspan.io/schemas/review/v1' as const;

/** Current provider-neutral review contract version. */
export const REVIEW_CONTRACT_SCHEMA_VERSION = 1 as const;

/** Bounded limits for host-supplied review metadata and suggestion text. */
export const DEFAULT_REVIEW_LIMITS = Object.freeze({
  maxIdentifierCodeUnits: 256,
  maxSuggestionTextCodeUnits: 1_048_576,
  maxThreadCount: 10_000,
  maxReplyCount: 10_000,
});

/** Stable public failure classifications for review contract validation. */
export type ReviewContractErrorCode =
  | 'invalid_review_contract'
  | 'unsupported_projection'
  | 'selector_out_of_range'
  | 'stale_revision'
  | 'operation_already_final'
  | 'operation_must_change_document'
  | 'rejected_operation_changed_document';

/** Redacted error raised when a review value cannot satisfy the contract. */
export class ReviewContractError extends TypeError {
  /** Stable machine-readable review failure classification. */
  readonly code: ReviewContractErrorCode;

  /** Create one redacted review-contract error without retaining input data. */
  constructor(code: ReviewContractErrorCode) {
    super(REVIEW_ERROR_MESSAGES[code]);
    this.name = 'ReviewContractError';
    this.code = code;
  }
}

/** Exact revision and selector target for one review thread or suggestion. */
export interface CwlEditorReviewTarget {
  /** SHA-256 revision of the document state containing this target. */
  readonly revision: CwlEditorDocumentRevision;
  /** W3C selector in the named deterministic Inkspan projection. */
  readonly selector: CwlEditorTextPositionSelector;
  /** Projection identity required to interpret selector offsets. */
  readonly textProjection: CwlEditorTextProjectionIdentity;
}

/** Host-supplied thread presentation state; comment bodies remain host-owned. */
export interface CwlEditorReviewThread {
  /** Opaque host-owned durable thread identifier. */
  readonly threadId: string;
  /** Exact revision-scoped location rendered by the editor. */
  readonly target: CwlEditorReviewTarget;
  /** Whether the host currently presents the thread as resolved. */
  readonly state: 'open' | 'resolved';
  /** Number of host-owned replies, without exposing their bodies. */
  readonly replyCount: number;
}

/** Lifecycle state of one host-owned insert/delete suggestion. */
export type ReviewSuggestionState = 'pending' | 'accepted' | 'rejected';

/** A deterministic text insertion suggestion at an empty target range. */
export interface CwlEditorInsertSuggestion {
  /** Opaque host-owned durable suggestion identifier. */
  readonly suggestionId: string;
  readonly kind: 'insert';
  readonly state: ReviewSuggestionState;
  /** Revision the host used when creating the suggestion. */
  readonly expectedRevision: CwlEditorDocumentRevision;
  /** Exact insertion target; its selector must have equal start and end. */
  readonly target: CwlEditorReviewTarget;
  /** Text proposed for deterministic insertion. */
  readonly text: string;
}

/** A deterministic deletion suggestion over one non-empty target range. */
export interface CwlEditorDeleteSuggestion {
  /** Opaque host-owned durable suggestion identifier. */
  readonly suggestionId: string;
  readonly kind: 'delete';
  readonly state: ReviewSuggestionState;
  /** Revision the host used when creating the suggestion. */
  readonly expectedRevision: CwlEditorDocumentRevision;
  /** Exact non-empty deletion target. */
  readonly target: CwlEditorReviewTarget;
}

/** First review vertical slice: deterministic insert and delete only. */
export type CwlEditorReviewSuggestion =
  | CwlEditorInsertSuggestion
  | CwlEditorDeleteSuggestion;

/** One host-requested operation against a pending suggestion. */
export interface CwlEditorReviewOperation {
  /** Suggestion selected by the host/user. */
  readonly suggestion: CwlEditorReviewSuggestion;
  /** Apply or discard the proposed operation. */
  readonly action: 'accept' | 'reject';
}

/** Result of one exact-revision review operation without document bodies. */
export interface CwlEditorReviewOperationResult {
  /** Stable contract identifier. */
  readonly schemaId: typeof REVIEW_CONTRACT_SCHEMA_ID;
  /** Stable contract version. */
  readonly schemaVersion: typeof REVIEW_CONTRACT_SCHEMA_VERSION;
  /** Opaque suggestion identifier copied from the host request. */
  readonly suggestionId: string;
  /** Operation requested by the host/user. */
  readonly action: 'accept' | 'reject';
  /** Whether the operation was applied, rejected, or blocked as stale. */
  readonly status: 'accepted' | 'rejected' | 'stale';
  /** Actual revision observed before the operation. */
  readonly beforeRevision: CwlEditorDocumentRevision;
  /** Resulting revision only when the operation was applied or rejected. */
  readonly resultingRevision?: CwlEditorDocumentRevision;
  /** Compact before/after evidence, never the document or comment body. */
  readonly transitionEvidence?: Readonly<{
    readonly previousRevision: CwlEditorDocumentRevision;
    readonly resultingRevision: CwlEditorDocumentRevision;
    readonly changed: boolean;
  }>;
}

const REVIEW_ERROR_MESSAGES: Record<ReviewContractErrorCode, string> = {
  invalid_review_contract: 'Review input does not match the supported contract',
  unsupported_projection: 'Review target uses an unsupported text projection',
  selector_out_of_range: 'Review selector is outside the supplied text projection',
  stale_revision: 'Review operation targets a stale document revision',
  operation_already_final: 'Review suggestion has already reached a final state',
  operation_must_change_document: 'Accepted review operation must change the document',
  rejected_operation_changed_document:
    'Rejected review operation must preserve the document revision',
};

/** Validate and freeze one review target without exposing source values in errors. */
export function validateReviewTarget(
  value: unknown,
): CwlEditorReviewTarget {
  return withRedactedReviewErrors(() => {
    const record = requireRecord(value);
    const revision = validateRevision(recordValue(record, 'revision'));
    const selector = validateSelector(recordValue(record, 'selector'));
    const textProjection = validateProjection(
      recordValue(record, 'textProjection'),
    );
    return Object.freeze({ revision, selector, textProjection });
  });
}

/** Validate and freeze host-owned thread presentation metadata. */
export function validateReviewThread(
  value: unknown,
  limits = DEFAULT_REVIEW_LIMITS,
): CwlEditorReviewThread {
  return withRedactedReviewErrors(() => {
    const record = requireRecord(value);
    const threadId = validateIdentifier(
      recordValue(record, 'threadId'),
      limits.maxIdentifierCodeUnits,
    );
    const target = validateReviewTarget(recordValue(record, 'target'));
    const state = recordValue(record, 'state');
    const replyCount = recordValue(record, 'replyCount');
    if (
      (state !== 'open' && state !== 'resolved') ||
      !isSafeInteger(replyCount) ||
      replyCount < 0 ||
      replyCount > limits.maxReplyCount
    ) {
      throw new ReviewContractError('invalid_review_contract');
    }
    return Object.freeze({
      threadId,
      target,
      state,
      replyCount,
    });
  });
}

/** Validate and freeze one insert/delete suggestion record. */
export function validateReviewSuggestion(
  value: unknown,
  limits = DEFAULT_REVIEW_LIMITS,
): CwlEditorReviewSuggestion {
  return withRedactedReviewErrors(() => {
    const record = requireRecord(value);
    const suggestionId = validateIdentifier(
      recordValue(record, 'suggestionId'),
      limits.maxIdentifierCodeUnits,
    );
    const kind = recordValue(record, 'kind');
    const state = recordValue(record, 'state');
    const expectedRevision = validateRevision(
      recordValue(record, 'expectedRevision'),
    );
    const target = validateReviewTarget(recordValue(record, 'target'));
    if (!isSuggestionState(state) || !sameRevision(expectedRevision, target.revision)) {
      throw new ReviewContractError('invalid_review_contract');
    }
    if (kind === 'insert') {
      const text = recordValue(record, 'text');
      if (
        typeof text !== 'string' ||
        text.length === 0 ||
        text.length > limits.maxSuggestionTextCodeUnits ||
        target.selector.start !== target.selector.end
      ) {
        throw new ReviewContractError('invalid_review_contract');
      }
      return Object.freeze({
        suggestionId,
        kind,
        state,
        expectedRevision,
        target,
        text,
      });
    }
    if (
      kind === 'delete' &&
      target.selector.start < target.selector.end
    ) {
      return Object.freeze({
        suggestionId,
        kind,
        state,
        expectedRevision,
        target,
      });
    }
    throw new ReviewContractError('invalid_review_contract');
  });
}

/**
 * Apply one accepted/rejected suggestion to a text projection.
 *
 * This helper is intentionally projection-only: it does not pretend that a
 * text result is an editor transaction or a durable revision. The interactive
 * layer must apply the same operation through its editor transaction and use
 * `createReviewOperationResult` for exact before/after evidence.
 */
export function applyReviewSuggestionToTextProjection(
  source: string,
  currentRevision: CwlEditorDocumentRevision,
  value: unknown,
  action: 'accept' | 'reject' = 'accept',
): string {
  const suggestion = validateReviewSuggestion(value);
  if (action !== 'accept' && action !== 'reject') {
    throw new ReviewContractError('invalid_review_contract');
  }
  if (suggestion.state !== 'pending') {
    throw new ReviewContractError('operation_already_final');
  }
  if (!sameRevision(currentRevision, suggestion.expectedRevision)) {
    throw new ReviewContractError('stale_revision');
  }
  const codePoints = Array.from(source);
  const { start, end } = suggestion.target.selector;
  if (start > codePoints.length || end > codePoints.length) {
    throw new ReviewContractError('selector_out_of_range');
  }
  if (action === 'reject') return source;
  if (suggestion.kind === 'insert') {
    return `${codePoints.slice(0, start).join('')}${suggestion.text}${codePoints
      .slice(end)
      .join('')}`;
  }
  return `${codePoints.slice(0, start).join('')}${codePoints
    .slice(end)
    .join('')}`;
}

/**
 * Bind an editor-produced before/after envelope pair to a review operation.
 *
 * The result contains only revisions and transition metadata. A stale expected
 * revision is returned as a stable result so hosts can refetch or re-review;
 * it is never silently re-anchored.
 */
export async function createReviewOperationResult(
  operation: CwlEditorReviewOperation,
  previousSource: CwlEditorDocumentEnvelope | string,
  resultingSource: CwlEditorDocumentEnvelope | string,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorReviewOperationResult> {
  const validatedOperation = validateReviewOperation(operation);
  const suggestion = validatedOperation.suggestion;
  if (suggestion.state !== 'pending') {
    throw new ReviewContractError('operation_already_final');
  }
  const transition = await createDocumentEnvelopeTransitionEvidence(
    previousSource,
    resultingSource,
    limits,
    digestProvider,
  );
  if (!sameRevision(transition.previousRevision, suggestion.expectedRevision)) {
    return Object.freeze({
      schemaId: REVIEW_CONTRACT_SCHEMA_ID,
      schemaVersion: REVIEW_CONTRACT_SCHEMA_VERSION,
      suggestionId: suggestion.suggestionId,
      action: validatedOperation.action,
      status: 'stale',
      beforeRevision: transition.previousRevision,
    });
  }
  if (validatedOperation.action === 'accept' && !transition.changed) {
    throw new ReviewContractError('operation_must_change_document');
  }
  if (validatedOperation.action === 'reject' && transition.changed) {
    throw new ReviewContractError('rejected_operation_changed_document');
  }
  return Object.freeze({
    schemaId: REVIEW_CONTRACT_SCHEMA_ID,
    schemaVersion: REVIEW_CONTRACT_SCHEMA_VERSION,
    suggestionId: suggestion.suggestionId,
    action: validatedOperation.action,
    status: validatedOperation.action === 'accept' ? 'accepted' : 'rejected',
    beforeRevision: transition.previousRevision,
    resultingRevision: transition.resultingRevision,
    transitionEvidence: transition,
  });
}

function validateReviewOperation(value: unknown): CwlEditorReviewOperation {
  return withRedactedReviewErrors(() => {
    const record = requireRecord(value);
    const action = recordValue(record, 'action');
    if (action !== 'accept' && action !== 'reject') {
      throw new ReviewContractError('invalid_review_contract');
    }
    return Object.freeze({
      suggestion: validateReviewSuggestion(recordValue(record, 'suggestion')),
      action,
    });
  });
}

function validateRevision(value: unknown): CwlEditorDocumentRevision {
  const record = requireRecord(value);
  const algorithm = recordValue(record, 'algorithm');
  const digestHex = recordValue(record, 'digestHex');
  const strongEntityTag = recordValue(record, 'strongEntityTag');
  if (
    algorithm !== 'SHA-256' ||
    typeof digestHex !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(digestHex) ||
    strongEntityTag !== `"sha256-${digestHex}"`
  ) {
    throw new ReviewContractError('invalid_review_contract');
  }
  return Object.freeze({ algorithm, digestHex, strongEntityTag });
}

function validateSelector(value: unknown): CwlEditorTextPositionSelector {
  const record = requireRecord(value);
  const type = recordValue(record, 'type');
  const start = recordValue(record, 'start');
  const end = recordValue(record, 'end');
  if (
    type !== 'TextPositionSelector' ||
    !isSafeInteger(start) ||
    !isSafeInteger(end) ||
    start < 0 ||
    end < start
  ) {
    throw new ReviewContractError('invalid_review_contract');
  }
  return Object.freeze({ type, start, end });
}

function validateProjection(value: unknown): CwlEditorTextProjectionIdentity {
  const record = requireRecord(value);
  const id = recordValue(record, 'id');
  const version = recordValue(record, 'version');
  if (id !== 'inkspan-prosemirror-text' || version !== 1) {
    throw new ReviewContractError('unsupported_projection');
  }
  return Object.freeze({ id, version });
}

function validateIdentifier(value: unknown, maxLength: number): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength
  ) {
    throw new ReviewContractError('invalid_review_contract');
  }
  return value;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReviewContractError('invalid_review_contract');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ReviewContractError('invalid_review_contract');
  }
  return value as Record<string, unknown>;
}

function recordValue(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || !('value' in descriptor)) {
    throw new ReviewContractError('invalid_review_contract');
  }
  return descriptor.value;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isSuggestionState(value: unknown): value is ReviewSuggestionState {
  return value === 'pending' || value === 'accepted' || value === 'rejected';
}

function sameRevision(
  left: CwlEditorDocumentRevision,
  right: CwlEditorDocumentRevision,
): boolean {
  return (
    left.algorithm === right.algorithm &&
    left.digestHex === right.digestHex &&
    left.strongEntityTag === right.strongEntityTag
  );
}

function withRedactedReviewErrors<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ReviewContractError) throw error;
    throw new ReviewContractError('invalid_review_contract');
  }
}
