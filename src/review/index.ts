/**
 * React-free review contract surface.
 *
 * Inkspan owns deterministic review targets and bounded proposal metadata bound
 * to an exact canonical document revision and text projection. Hosts own durable
 * review records, identity, authorization, tenancy, persistence, retention,
 * notifications, audit, and cross-revision re-anchoring policy.
 */

import type { CwlEditorDocumentRevision } from '../documentEnvelopeRevision.js';
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

const REVIEW_TARGET_KEYS = [
  'contractVersion',
  'revision',
  'selector',
  'projection',
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
const MAX_REVIEW_INSERT_TEXT_CODE_UNITS = 65_536;

/** Throw one fresh redacted public validation error. */
function rejectReviewTarget(): never {
  throw new CwlReviewTargetError();
}

/** Throw one fresh redacted public suggestion validation error. */
function rejectReviewSuggestion(): never {
  throw new CwlReviewSuggestionError();
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
    revision.strongEntityTag !== `\"sha256-${digestHex}\"`
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
    strongEntityTag: `\"sha256-${digestHex}\"`,
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
/**
 * Framework-independent Inkspan review contract.
 *
 * The package validates bounded revision-scoped target metadata and
 * deterministic insert/delete operation results. Comment bodies, durable
 * identifiers, authorization, persistence, and collaboration transport stay
 * with the host.
 */
export {
  DEFAULT_REVIEW_LIMITS,
  REVIEW_CONTRACT_SCHEMA_ID,
  REVIEW_CONTRACT_SCHEMA_VERSION,
  ReviewContractError,
  applyReviewSuggestionToTextProjection,
  createReviewOperationResult,
  validateReviewSuggestion,
  validateReviewTarget,
  validateReviewThread,
} from './contract.js';
export type {
  CwlEditorDeleteSuggestion,
  CwlEditorInsertSuggestion,
  CwlEditorReviewOperation,
  CwlEditorReviewOperationResult,
  CwlEditorReviewSuggestion,
  CwlEditorReviewTarget,
  CwlEditorReviewThread,
  ReviewContractErrorCode,
  ReviewSuggestionState,
} from './contract.js';
