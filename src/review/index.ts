/**
 * React-free review contract surface.
 *
 * Inkspan owns deterministic review targets bound to an exact canonical
 * document revision and text projection. Hosts own durable review records,
 * identity, authorization, tenancy, persistence, retention, notifications,
 * audit, and cross-revision re-anchoring policy.
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

const REVIEW_TARGET_KEYS = [
  'contractVersion',
  'revision',
  'selector',
  'projection',
] as const;
const REVISION_KEYS = ['algorithm', 'digestHex', 'strongEntityTag'] as const;
const SELECTOR_KEYS = ['type', 'start', 'end'] as const;
const PROJECTION_KEYS = ['id', 'version'] as const;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u;

/** Throw one fresh redacted public validation error. */
function rejectReviewTarget(): never {
  throw new CwlReviewTargetError();
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
