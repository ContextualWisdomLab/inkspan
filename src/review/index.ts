/**
 * React-free review contract surface.
 *
 * Inkspan owns deterministic review targets and bounded proposal metadata bound
 * to an exact canonical document revision and text projection. Hosts own durable
 * review records, identity, authorization, tenancy, persistence, retention,
 * notifications, audit, and cross-revision re-anchoring policy.
 */

import type { DocumentEnvelopeLimits } from '../documentEnvelope.js';
import type {
  CwlEditorDocumentRevision,
  DocumentEnvelopeDigestProvider,
} from '../documentEnvelopeRevision.js';
import {
  createDocumentEnvelopeTransitionEvidence,
  type CwlEditorDocumentTransitionEvidence,
} from '../documentTransitionEvidence.js';
import {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  type CwlEditorTextPositionSelector,
  type CwlEditorTextProjectionIdentity,
} from '../textPositionSelectorEvidence.js';

/** Version of Inkspan's deterministic review-target contract. */
export const INKSPAN_REVIEW_CONTRACT_VERSION = 1 as const;

/** Stable redacted failure code for malformed review-target metadata. */
export type CwlReviewTargetErrorCode = 'invalid_target';

/** Raised when untrusted review-target metadata violates the public contract. */
export class CwlReviewTargetError extends Error {
  /** Stable machine-readable failure category. */
  readonly code: CwlReviewTargetErrorCode;

  /** Create one redacted review-target validation error. */
  constructor() {
    super('Review target metadata is invalid.');
    this.name = 'CwlReviewTargetError';
    this.code = 'invalid_target';
  }
}

/** Stable redacted failure code for malformed suggestion proposal metadata. */
export type CwlReviewSuggestionErrorCode = 'invalid_suggestion';

/** Raised when untrusted suggestion proposal metadata violates the contract. */
export class CwlReviewSuggestionError extends Error {
  /** Stable machine-readable failure category. */
  readonly code: CwlReviewSuggestionErrorCode;

  /** Create one redacted suggestion validation error. */
  constructor() {
    super('Review suggestion is invalid.');
    this.name = 'CwlReviewSuggestionError';
    this.code = 'invalid_suggestion';
  }
}

/** Stable redacted failure code for malformed review presentation metadata. */
export type CwlReviewPresentationErrorCode = 'invalid_presentation';

/** Raised when host-supplied thread presentation metadata violates the contract. */
export class CwlReviewPresentationError extends Error {
  /** Stable machine-readable failure category. */
  readonly code: CwlReviewPresentationErrorCode;

  /** Create one payload-redacted presentation validation error. */
  constructor() {
    super('Review presentation metadata is invalid.');
    this.name = 'CwlReviewPresentationError';
    this.code = 'invalid_presentation';
  }
}

/** Stable redacted failure codes for review-operation evidence. */
export type CwlReviewOperationErrorCode =
  | 'invalid_operation'
  | 'stale_operation_changed'
  | 'accepted_operation_unchanged'
  | 'rejected_operation_changed';

const REVIEW_OPERATION_ERROR_MESSAGES: Record<
  CwlReviewOperationErrorCode,
  string
> = {
  invalid_operation: 'Review operation is invalid.',
  stale_operation_changed: 'Stale review operations must not change the document.',
  accepted_operation_unchanged:
    'Accepted review operation must change the document revision.',
  rejected_operation_changed:
    'Rejected review operation must preserve the document revision.',
};

/** Raised when before/after review-operation evidence violates the contract. */
export class CwlReviewOperationError extends Error {
  /** Stable machine-readable failure category. */
  readonly code: CwlReviewOperationErrorCode;

  /** Create one payload-redacted review-operation error. */
  constructor(code: CwlReviewOperationErrorCode) {
    super(REVIEW_OPERATION_ERROR_MESSAGES[code]);
    this.name = 'CwlReviewOperationError';
    this.code = code;
  }
}

/**
 * Immutable target for a host-owned comment or suggestion.
 *
 * Positions are W3C TextPositionSelector offsets in Inkspan's canonical text
 * projection, never DOM offsets. The revision validator prevents a host from
 * silently applying a target to a different document revision. This metadata
 * contract validates shape and coordinate ordering only; without the source
 * document it cannot prove that an arbitrary caller-supplied `end` offset is
 * within the referenced projection. Consumers should create selectors through
 * Inkspan's selector APIs and reject revision mismatches before applying them.
 */
export interface CwlReviewTarget {
  readonly contractVersion: typeof INKSPAN_REVIEW_CONTRACT_VERSION;
  readonly revision: CwlEditorDocumentRevision;
  readonly selector: CwlEditorTextPositionSelector;
  readonly projection: CwlEditorTextProjectionIdentity;
}

/** Bounded host-supplied metadata used to render one comment-thread target. */
export interface CwlReviewThreadPresentation {
  readonly contractVersion: typeof INKSPAN_REVIEW_CONTRACT_VERSION;
  /** Opaque host-owned key carried for callback correlation, never generated here. */
  readonly threadKey: string;
  readonly target: CwlReviewTarget;
  readonly state: 'unresolved' | 'resolved';
  readonly commentCount: number;
  readonly selected: boolean;
  readonly canReply: boolean;
  readonly canResolve: boolean;
}

/** Detached insertion proposal with no host identity or persistence authority. */
export interface CwlReviewInsertSuggestion {
  readonly contractVersion: typeof INKSPAN_REVIEW_CONTRACT_VERSION;
  readonly kind: 'insert';
  readonly target: CwlReviewTarget;
  readonly text: string;
}

/** Detached deletion proposal with no copied source text or durable authority. */
export interface CwlReviewDeleteSuggestion {
  readonly contractVersion: typeof INKSPAN_REVIEW_CONTRACT_VERSION;
  readonly kind: 'delete';
  readonly target: CwlReviewTarget;
}

/** Provider-neutral proposal data accepted by Inkspan's review contract. */
export type CwlReviewSuggestion =
  | CwlReviewInsertSuggestion
  | CwlReviewDeleteSuggestion;

/** Review decision whose effect is proven only through exact revision evidence. */
export interface CwlReviewOperationResult {
  readonly contractVersion: typeof INKSPAN_REVIEW_CONTRACT_VERSION;
  readonly action: 'accept' | 'reject';
  readonly status: 'accepted' | 'rejected' | 'stale';
  readonly beforeRevision: CwlEditorDocumentRevision;
  readonly resultingRevision?: CwlEditorDocumentRevision;
  readonly transitionEvidence?: CwlEditorDocumentTransitionEvidence;
}

const REVIEW_TARGET_KEYS = [
  'contractVersion',
  'revision',
  'selector',
  'projection',
] as const;
const REVIEW_PRESENTATION_KEYS = [
  'contractVersion',
  'threadKey',
  'target',
  'state',
  'commentCount',
  'selected',
  'canReply',
  'canResolve',
] as const;
const INSERT_SUGGESTION_KEYS = [
  'contractVersion',
  'kind',
  'target',
  'text',
] as const;
const DELETE_SUGGESTION_KEYS = ['contractVersion', 'kind', 'target'] as const;
const REVISION_KEYS = ['algorithm', 'digestHex', 'strongEntityTag'] as const;
const SELECTOR_KEYS = ['type', 'start', 'end'] as const;
const PROJECTION_KEYS = ['id', 'version'] as const;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u;
const REVIEW_THREAD_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const MAX_REVIEW_INSERT_TEXT_CODE_UNITS = 65_536;
const MAX_REVIEW_COMMENT_COUNT = 10_000;

/** Throw one fresh redacted public validation error. */
function rejectReviewTarget(): never {
  throw new CwlReviewTargetError();
}

/** Throw one fresh redacted public suggestion validation error. */
function rejectReviewSuggestion(): never {
  throw new CwlReviewSuggestionError();
}

/** Throw one fresh redacted public presentation validation error. */
function rejectReviewPresentation(): never {
  throw new CwlReviewPresentationError();
}

/**
 * Snapshot exactly named enumerable data properties without invoking accessors.
 *
 * Unknown keys, symbols, accessors, non-enumerable fields, and reflection
 * failures are rejected before Inkspan retains any caller-owned object.
 */
function readExactDataRecord(
  source: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  try {
    if (typeof source !== 'object' || source === null) rejectReviewTarget();
    const ownKeys = Reflect.ownKeys(source);
    if (ownKeys.length !== expectedKeys.length) rejectReviewTarget();
    for (const key of ownKeys) {
      if (typeof key !== 'string' || !expectedKeys.includes(key)) {
        rejectReviewTarget();
      }
    }

    const values: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        rejectReviewTarget();
      }
      values[key] = descriptor.value;
    }
    return values;
  } catch {
    rejectReviewTarget();
  }
}

/**
 * Read only the discriminant needed to choose the exact suggestion shape.
 * Accessors and reflection failures are rejected without invoking caller code.
 */
function readSuggestionKind(source: unknown): 'insert' | 'delete' {
  try {
    if (typeof source !== 'object' || source === null) rejectReviewSuggestion();
    const descriptor = Object.getOwnPropertyDescriptor(source, 'kind');
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      rejectReviewSuggestion();
    }
    if (descriptor.value !== 'insert' && descriptor.value !== 'delete') {
      rejectReviewSuggestion();
    }
    return descriptor.value;
  } catch {
    rejectReviewSuggestion();
  }
}

/**
 * Validate and detach untrusted host review-target metadata.
 *
 * The returned value is deeply frozen across the complete v1 target shape and
 * retains no caller-owned nested objects. Reflection/accessor failures and all
 * malformed fields collapse to one redacted stable error so private caller data
 * is never copied into generic diagnostics. The revision is local SHA-256
 * equality evidence only; this operation grants no identity, authorization,
 * tenancy, persistence, timestamp, signature, or durable-write authority.
 *
 * @param source - Untrusted candidate review-target metadata.
 * @returns A detached, deeply frozen v1 review target.
 * @throws {CwlReviewTargetError} When any target field or shape is invalid.
 */
export function createReviewTarget(source: unknown): CwlReviewTarget {
  const target = readExactDataRecord(source, REVIEW_TARGET_KEYS);
  if (target.contractVersion !== INKSPAN_REVIEW_CONTRACT_VERSION) {
    rejectReviewTarget();
  }

  const revision = readExactDataRecord(target.revision, REVISION_KEYS);
  const digestHex = revision.digestHex;
  if (
    revision.algorithm !== 'SHA-256' ||
    typeof digestHex !== 'string' ||
    digestHex.length !== 64 ||
    !SHA256_HEX_PATTERN.test(digestHex) ||
    revision.strongEntityTag !== `"sha256-${digestHex}"`
  ) {
    rejectReviewTarget();
  }

  const selector = readExactDataRecord(target.selector, SELECTOR_KEYS);
  const start = selector.start;
  const end = selector.end;
  if (
    selector.type !== 'TextPositionSelector' ||
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start
  ) {
    rejectReviewTarget();
  }

  const projection = readExactDataRecord(target.projection, PROJECTION_KEYS);
  if (
    projection.id !== TEXT_POSITION_PROJECTION_ID ||
    projection.version !== TEXT_POSITION_PROJECTION_VERSION
  ) {
    rejectReviewTarget();
  }

  const detachedRevision: CwlEditorDocumentRevision = Object.freeze({
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  });
  const detachedSelector: CwlEditorTextPositionSelector = Object.freeze({
    type: 'TextPositionSelector',
    start,
    end,
  });
  const detachedProjection: CwlEditorTextProjectionIdentity = Object.freeze({
    id: TEXT_POSITION_PROJECTION_ID,
    version: TEXT_POSITION_PROJECTION_VERSION,
  });
  return Object.freeze({
    contractVersion: INKSPAN_REVIEW_CONTRACT_VERSION,
    revision: detachedRevision,
    selector: detachedSelector,
    projection: detachedProjection,
  });
}

/**
 * Validate and detach host-supplied comment-thread presentation metadata.
 *
 * The contract deliberately carries no comment body, actor identity,
 * authorization assertion, timestamp, persistence state, or durable audit data.
 * `threadKey` is an opaque bounded host-owned correlation key only; Inkspan does
 * not generate, persist, authenticate, or interpret it. `commentCount`, status,
 * selection, and capability booleans are presentation inputs for later
 * controlled UI surfaces and grant no host authority by themselves.
 *
 * @param source - Untrusted host presentation metadata.
 * @returns A detached, deeply frozen bounded presentation snapshot.
 * @throws {CwlReviewPresentationError} When any field or shape is invalid.
 */
export function createReviewThreadPresentation(
  source: unknown,
): CwlReviewThreadPresentation {
  try {
    const presentation = readExactDataRecord(source, REVIEW_PRESENTATION_KEYS);
    if (
      presentation.contractVersion !== INKSPAN_REVIEW_CONTRACT_VERSION ||
      typeof presentation.threadKey !== 'string' ||
      !REVIEW_THREAD_KEY_PATTERN.test(presentation.threadKey) ||
      (presentation.state !== 'unresolved' && presentation.state !== 'resolved') ||
      typeof presentation.commentCount !== 'number' ||
      !Number.isSafeInteger(presentation.commentCount) ||
      presentation.commentCount < 1 ||
      presentation.commentCount > MAX_REVIEW_COMMENT_COUNT ||
      typeof presentation.selected !== 'boolean' ||
      typeof presentation.canReply !== 'boolean' ||
      typeof presentation.canResolve !== 'boolean'
    ) {
      rejectReviewPresentation();
    }

    const target = createReviewTarget(presentation.target);
    return Object.freeze({
      contractVersion: INKSPAN_REVIEW_CONTRACT_VERSION,
      threadKey: presentation.threadKey,
      target,
      state: presentation.state,
      commentCount: presentation.commentCount,
      selected: presentation.selected,
      canReply: presentation.canReply,
      canResolve: presentation.canResolve,
    });
  } catch {
    rejectReviewPresentation();
  }
}

/**
 * Validate and detach an untrusted insert/delete suggestion proposal.
 *
 * Insertions must target an insertion point and carry 1..65,536 UTF-16 code
 * units of proposal text. Deletions must target a non-empty projected range and
 * deliberately carry no copied source body. The returned proposal and target
 * are frozen snapshots. This validator does not apply edits, persist records,
 * assign identities, authorize actors, or grant model/provider output any
 * authority; hosts must still perform admission and Inkspan revision checks at
 * the operation boundary.
 *
 * @param source - Untrusted candidate suggestion proposal metadata.
 * @returns A detached, deeply frozen v1 suggestion proposal.
 * @throws {CwlReviewSuggestionError} When any proposal field or shape is invalid.
 */
export function createReviewSuggestion(source: unknown): CwlReviewSuggestion {
  try {
    const kind = readSuggestionKind(source);
    const expectedKeys =
      kind === 'insert' ? INSERT_SUGGESTION_KEYS : DELETE_SUGGESTION_KEYS;
    const suggestion = readExactDataRecord(source, expectedKeys);
    if (
      suggestion.contractVersion !== INKSPAN_REVIEW_CONTRACT_VERSION ||
      suggestion.kind !== kind
    ) {
      rejectReviewSuggestion();
    }

    const target = createReviewTarget(suggestion.target);
    if (kind === 'insert') {
      const text = suggestion.text;
      if (
        target.selector.start !== target.selector.end ||
        typeof text !== 'string' ||
        text.length === 0 ||
        text.length > MAX_REVIEW_INSERT_TEXT_CODE_UNITS
      ) {
        rejectReviewSuggestion();
      }
      return Object.freeze({
        contractVersion: INKSPAN_REVIEW_CONTRACT_VERSION,
        kind,
        target,
        text,
      });
    }

    if (target.selector.start === target.selector.end) {
      rejectReviewSuggestion();
    }
    return Object.freeze({
      contractVersion: INKSPAN_REVIEW_CONTRACT_VERSION,
      kind,
      target,
    });
  } catch {
    rejectReviewSuggestion();
  }
}

/**
 * Bind a host/editor review decision to exact before/after document revisions.
 *
 * This function does not apply an editor transaction and does not persist a
 * review decision. The caller supplies the actual previous and resulting
 * document envelopes after its authorized operation. Inkspan validates the
 * proposal, derives canonical transition evidence, and refuses to classify an
 * accepted operation that changed nothing or a rejected operation that changed
 * the document. A stale proposal returns a compact `stale` result only when the
 * actual document remained unchanged; stale evidence paired with a mutation is
 * rejected fail-closed rather than hiding an out-of-contract document change.
 *
 * The result contains revisions and transition metadata only; proposal text and
 * document bodies are not retained. Host-owned identity, authorization,
 * persistence, exact-once durable state, audit, and conflict policy remain out
 * of scope.
 *
 * @param suggestionSource - Untrusted provider-neutral insert/delete proposal.
 * @param action - Host-authorized review decision to classify.
 * @param previousSource - Exact document envelope observed before the operation.
 * @param resultingSource - Exact document envelope observed after the operation.
 * @param limits - Optional strict document-envelope resource limits.
 * @param digestProvider - Optional SHA-256 provider for deterministic testing.
 * @returns Frozen revision-only review-operation evidence.
 * @throws {CwlReviewOperationError} When action/change semantics conflict.
 */
export async function createReviewOperationResult(
  suggestionSource: unknown,
  action: 'accept' | 'reject',
  previousSource: unknown,
  resultingSource: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlReviewOperationResult> {
  if (action !== 'accept' && action !== 'reject') {
    throw new CwlReviewOperationError('invalid_operation');
  }
  const suggestion = createReviewSuggestion(suggestionSource);
  const transition = await createDocumentEnvelopeTransitionEvidence(
    previousSource,
    resultingSource,
    limits,
    digestProvider,
  );

  if (
    transition.previousRevision.digestHex !== suggestion.target.revision.digestHex
  ) {
    if (transition.changed) {
      throw new CwlReviewOperationError('stale_operation_changed');
    }
    return Object.freeze({
      contractVersion: INKSPAN_REVIEW_CONTRACT_VERSION,
      action,
      status: 'stale',
      beforeRevision: transition.previousRevision,
    });
  }
  if (action === 'accept' && !transition.changed) {
    throw new CwlReviewOperationError('accepted_operation_unchanged');
  }
  if (action === 'reject' && transition.changed) {
    throw new CwlReviewOperationError('rejected_operation_changed');
  }

  return Object.freeze({
    contractVersion: INKSPAN_REVIEW_CONTRACT_VERSION,
    action,
    status: action === 'accept' ? 'accepted' : 'rejected',
    beforeRevision: transition.previousRevision,
    resultingRevision: transition.resultingRevision,
    transitionEvidence: transition,
  });
}

export {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  TextPositionSelectorEvidenceError,
  createTextPositionSelector,
} from '../textPositionSelectorEvidence.js';
export type {
  CwlEditorTextPositionSelector,
  CwlEditorTextProjectionIdentity,
  TextPositionSelectorEvidenceErrorCode,
} from '../textPositionSelectorEvidence.js';
export {
  DocumentEnvelopeRevisionError,
  createDocumentEnvelopeRevision,
  createDocumentEnvelopeRevisionBytes,
} from '../documentEnvelopeRevision.js';
export type {
  CwlEditorDocumentRevision,
  DocumentEnvelopeDigestProvider,
} from '../documentEnvelopeRevision.js';
export type { CwlEditorDocumentTransitionEvidence } from '../documentTransitionEvidence.js';
