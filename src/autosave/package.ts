import {
  DocumentAutosaveQueueError as InternalDocumentAutosaveQueueError,
  createDocumentAutosaveQueue as createInternalDocumentAutosaveQueue,
} from './index.js';
import { createDetachedAutosaveRevisionEvidence } from './evidenceValidation.js';

/** Opaque frozen envelope shape required by the framework-free autosave API. */
export interface DocumentAutosaveEnvelope {
  /** Exact active Inkspan document-envelope schema identifier. */
  readonly schemaId: 'https://inkspan.io/schemas/document-envelope/v1';
  /** Exact active Inkspan document-envelope schema version. */
  readonly schemaVersion: 1;
  /** Frozen opaque document tree proposed for durable persistence. */
  readonly documentJson: Readonly<object>;
}

/** SHA-256 revision metadata required by the framework-free autosave API. */
export interface DocumentAutosaveRevision {
  /** Digest algorithm required by the current revision-evidence contract. */
  readonly algorithm: 'SHA-256';
  /** Lowercase hexadecimal SHA-256 digest. */
  readonly digestHex: string;
  /** RFC 9110-compatible strong entity tag derived from the digest. */
  readonly strongEntityTag: string;
}

/**
 * Framework-independent evidence accepted by the autosave coordinator.
 *
 * Inkspan `CwlEditorDocumentRevisionEvidence` values are structurally compatible
 * with this narrower contract. Keeping the document tree opaque prevents React,
 * TipTap, ProseMirror, Yjs, DOM, and Node types from entering this package's
 * declaration graph.
 */
export interface DocumentAutosaveRevisionEvidence {
  /** Frozen active-schema document envelope proposed for durable persistence. */
  readonly envelope: Readonly<DocumentAutosaveEnvelope>;
  /** Frozen strong revision metadata for the proposed envelope. */
  readonly revision: Readonly<DocumentAutosaveRevision>;
}

/** Lifecycle states exposed by a document autosave queue snapshot. */
export type DocumentAutosaveQueueState =
  | 'idle'
  | 'saving'
  | 'blocked'
  | 'closing'
  | 'closed';

/** Reasons that require an explicit host recovery decision. */
export type DocumentAutosaveBlockedReason = 'conflict' | 'failure';

/** Stable machine-readable categories for redacted autosave errors. */
export type DocumentAutosaveQueueErrorCode =
  | 'invalid_options'
  | 'invalid_revision_evidence'
  | 'invalid_recovery_validator'
  | 'host_save_failed'
  | 'invalid_save_result';

/** Public structural contract implemented by redacted autosave errors. */
export interface DocumentAutosaveQueueError extends Error {
  /** Stable category that callers can branch on without parsing messages. */
  readonly code: DocumentAutosaveQueueErrorCode;
}

/** Constructor contract for the runtime autosave queue error class. */
export interface DocumentAutosaveQueueErrorConstructor {
  /** Prototype shared by runtime autosave queue errors. */
  readonly prototype: DocumentAutosaveQueueError;
  /**
   * Construct one redacted autosave queue error.
   *
   * Applications normally receive these from queue operations rather than
   * constructing them directly.
   *
   * @param code - Stable machine-readable failure category.
   * @param message - Redacted beginner-readable explanation.
   */
  new (
    code: DocumentAutosaveQueueErrorCode,
    message: string,
  ): DocumentAutosaveQueueError;
}

/**
 * Runtime error constructor without an editor-framework declaration dependency.
 */
export const DocumentAutosaveQueueError =
  InternalDocumentAutosaveQueueError as unknown as DocumentAutosaveQueueErrorConstructor;

/** Result returned by a host-owned durable save callback. */
export type DocumentAutosaveSaveResult =
  | Readonly<{ status: 'saved' }>
  | Readonly<{ status: 'conflict' }>;

/**
 * Host-owned operation that attempts one authorized durable document write.
 *
 * Inkspan invokes this function at most once at a time. The host owns transport,
 * authorization, tenant isolation, persistence, credentials, migration,
 * retention, audit storage, retry budgets, and atomic RFC 9110 `If-Match`.
 */
export type DocumentAutosaveSaveFunction = (
  evidence: DocumentAutosaveRevisionEvidence,
) => DocumentAutosaveSaveResult | PromiseLike<DocumentAutosaveSaveResult>;

/** Options required to create a document autosave queue. */
export interface DocumentAutosaveQueueOptions {
  /** Host-owned operation used for every revision that becomes active. */
  readonly save: DocumentAutosaveSaveFunction;
  /**
   * Optional bounded observer invoked after distinct lifecycle transitions.
   *
   * Inkspan retains at most this one callback, never invokes it during queue
   * construction, and ignores callback exceptions so presentation or telemetry
   * code cannot change persistence ordering. Snapshots contain no document body.
   */
  readonly onSnapshotChange?: (snapshot: DocumentAutosaveQueueSnapshot) => void;
}

/** Outcome for a revision that the host reported as durably saved. */
export interface DocumentAutosaveSavedOutcome {
  /** Indicates that the host reported a successful durable write. */
  readonly status: 'saved';
  /** Strong equality validator for the submitted immutable evidence. */
  readonly strongEntityTag: string;
}

/** Outcome for a revision still known to be durably current. */
export interface DocumentAutosaveUnchangedOutcome {
  /** Indicates that no duplicate host callback was necessary. */
  readonly status: 'unchanged';
  /** Strong equality validator still known to be durably current. */
  readonly strongEntityTag: string;
}

/** Outcome for pending work replaced before its host callback began. */
export interface DocumentAutosaveSupersededOutcome {
  /** Indicates that a newer pending revision replaced this request. */
  readonly status: 'superseded';
  /** Strong equality validator of the request that did not start. */
  readonly strongEntityTag: string;
  /** Strong equality validator of the retained newer pending request. */
  readonly supersededByStrongEntityTag: string;
}

/** Outcome for a host-reported optimistic-concurrency conflict. */
export interface DocumentAutosaveConflictOutcome {
  /** Indicates that the host rejected the durable write as a conflict. */
  readonly status: 'conflict';
  /** Strong equality validator of the conflicting request. */
  readonly strongEntityTag: string;
}

/** Outcome for work rejected because queue shutdown had begun. */
export interface DocumentAutosaveClosedOutcome {
  /** Indicates that the request could not start after shutdown began. */
  readonly status: 'closed';
  /** Strong equality validator of the request that did not start. */
  readonly strongEntityTag: string;
}

/** Every non-exceptional result returned by `enqueue()`. */
export type DocumentAutosaveRequestOutcome =
  | DocumentAutosaveSavedOutcome
  | DocumentAutosaveUnchangedOutcome
  | DocumentAutosaveSupersededOutcome
  | DocumentAutosaveConflictOutcome
  | DocumentAutosaveClosedOutcome;

/** Frozen document-free lifecycle metadata for one autosave queue. */
export interface DocumentAutosaveQueueSnapshot {
  /** Current local lifecycle state. */
  readonly state: DocumentAutosaveQueueState;
  /** Recovery reason while blocked, or `null` in every other state. */
  readonly blockedReason: DocumentAutosaveBlockedReason | null;
  /** Revision currently inside the host callback, when one exists. */
  readonly activeStrongEntityTag: string | null;
  /** Newest not-yet-started revision, when one exists. */
  readonly pendingStrongEntityTag: string | null;
  /** Most recent revision that the host reported as durably saved. */
  readonly lastSavedStrongEntityTag: string | null;
}

/** Provider-neutral single-flight coordinator for immutable revision evidence. */
export interface DocumentAutosaveQueue {
  /**
   * Queue one immutable revision for the host-owned save operation.
   *
   * The public boundary snapshots descriptor values into a detached deeply
   * frozen envelope before scheduling, so transparent proxy getters cannot
   * change what the host callback receives after validation.
   *
   * @param evidence - Frozen evidence returned by Inkspan revision APIs.
   * @returns A promise for the deterministic local request outcome.
   */
  enqueue(
    evidence: DocumentAutosaveRevisionEvidence,
  ): Promise<DocumentAutosaveRequestOutcome>;
  /**
   * Resume progression after the host completes conflict or failure recovery.
   *
   * @returns `true` when one blocked state was cleared; otherwise `false`.
   */
  resume(): boolean;
  /**
   * Wait until the queue becomes idle, blocked, or closed.
   *
   * Concurrent nonterminal calls share one pending promise, bounding queue-owned
   * waiter retention independently of host polling frequency.
   *
   * @returns The first terminal-for-flush immutable snapshot.
   */
  flush(): Promise<DocumentAutosaveQueueSnapshot>;
  /**
   * Reject new work, close pending work, and let active transport finish.
   *
   * @returns The final immutable closed snapshot.
   */
  close(): Promise<DocumentAutosaveQueueSnapshot>;
  /**
   * Read current document-free lifecycle metadata without waiting.
   *
   * @returns A newly created immutable snapshot.
   */
  getSnapshot(): DocumentAutosaveQueueSnapshot;
}

const DOCUMENT_AUTOSAVE_QUEUE_OPTION_KEYS = ['save', 'onSnapshotChange'] as const;

/** Create one redacted invalid-options error for the framework-free boundary. */
function createInvalidQueueOptionsError(): InternalDocumentAutosaveQueueError {
  return new InternalDocumentAutosaveQueueError(
    'invalid_options',
    'Document autosave queue options are invalid.',
  );
}

/**
 * Read exact queue option values without invoking accessors or retaining extras.
 *
 * The optional observer must be an enumerable data property when present.
 * Unknown keys, symbols, accessors, non-enumerable fields, and reflection
 * failures are rejected before any host callback can execute.
 */
function readDocumentAutosaveQueueOptions(
  options: DocumentAutosaveQueueOptions,
): Readonly<{
  save: DocumentAutosaveSaveFunction;
  onSnapshotChange: ((snapshot: DocumentAutosaveQueueSnapshot) => void) | null;
}> {
  try {
    if (typeof options !== 'object' || options === null) {
      throw createInvalidQueueOptionsError();
    }
    const optionKeys = Reflect.ownKeys(options);
    if (
      optionKeys.length < 1 ||
      optionKeys.length > DOCUMENT_AUTOSAVE_QUEUE_OPTION_KEYS.length ||
      optionKeys.some(
        (optionKey) =>
          typeof optionKey !== 'string' ||
          !DOCUMENT_AUTOSAVE_QUEUE_OPTION_KEYS.includes(
            optionKey as (typeof DOCUMENT_AUTOSAVE_QUEUE_OPTION_KEYS)[number],
          ),
      )
    ) {
      throw createInvalidQueueOptionsError();
    }
    const saveDescriptor = Object.getOwnPropertyDescriptor(options, 'save');
    const observerDescriptor = Object.getOwnPropertyDescriptor(
      options,
      'onSnapshotChange',
    );
    if (
      saveDescriptor === undefined ||
      !saveDescriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(saveDescriptor, 'value') ||
      typeof saveDescriptor.value !== 'function' ||
      (observerDescriptor !== undefined &&
        (!observerDescriptor.enumerable ||
          !Object.prototype.hasOwnProperty.call(observerDescriptor, 'value') ||
          typeof observerDescriptor.value !== 'function'))
    ) {
      throw createInvalidQueueOptionsError();
    }
    return Object.freeze({
      save: saveDescriptor.value as DocumentAutosaveSaveFunction,
      onSnapshotChange:
        observerDescriptor === undefined
          ? null
          : (observerDescriptor.value as (
              snapshot: DocumentAutosaveQueueSnapshot,
            ) => void),
    });
  } catch {
    throw createInvalidQueueOptionsError();
  }
}

/**
 * Create a framework-independent single-flight document autosave queue.
 *
 * This explicit package-boundary adapter keeps the runtime implementation and
 * public declarations behaviorally identical while preventing editor-framework
 * types from leaking into standalone autosave consumers. Every accepted request
 * is normalized into a detached frozen snapshot before the internal queue can
 * retain it or invoke host transport. An optional lifecycle observer receives
 * only distinct document-free snapshots and cannot alter queue outcomes by
 * throwing.
 *
 * @param options - Exact object containing the host-owned save callback and optional observer.
 * @returns A frozen provider-neutral autosave queue.
 * @throws {DocumentAutosaveQueueError} When options are malformed.
 */
export function createDocumentAutosaveQueue(
  options: DocumentAutosaveQueueOptions,
): DocumentAutosaveQueue {
  const validatedOptions = readDocumentAutosaveQueueOptions(options);
  const internalQueue = createInternalDocumentAutosaveQueue({
    save: validatedOptions.save as never,
  }) as unknown as DocumentAutosaveQueue;
  let lastObservedSnapshotJson: string | null = null;

  /** Notify the retained observer only when externally visible state changed. */
  function emitSnapshotChange(): void {
    if (validatedOptions.onSnapshotChange === null) return;
    const snapshot = internalQueue.getSnapshot();
    const snapshotJson = JSON.stringify(snapshot);
    if (snapshotJson === lastObservedSnapshotJson) return;
    lastObservedSnapshotJson = snapshotJson;
    try {
      validatedOptions.onSnapshotChange(snapshot);
    } catch {
      // Observer code is presentation/telemetry only and cannot affect saving.
    }
  }

  /** Observe one eventual request settlement without replacing its promise. */
  function observeRequestSettlement(
    request: Promise<DocumentAutosaveRequestOutcome>,
  ): void {
    void request.then(emitSnapshotChange, emitSnapshotChange);
  }

  /** Queue one detached revision and publish its current lifecycle transition. */
  function enqueue(
    evidence: DocumentAutosaveRevisionEvidence,
  ): Promise<DocumentAutosaveRequestOutcome> {
    const detachedEvidence = createDetachedAutosaveRevisionEvidence(evidence);
    if (detachedEvidence === null) {
      throw new InternalDocumentAutosaveQueueError(
        'invalid_revision_evidence',
        'Document revision evidence is invalid.',
      );
    }
    const request = internalQueue.enqueue(detachedEvidence);
    emitSnapshotChange();
    observeRequestSettlement(request);
    return request;
  }

  /** Resume blocked progression and publish the resulting current state. */
  function resume(): boolean {
    const resumed = internalQueue.resume();
    emitSnapshotChange();
    return resumed;
  }

  /** Close local progression and publish closing or closed lifecycle state. */
  function close(): Promise<DocumentAutosaveQueueSnapshot> {
    const closing = internalQueue.close();
    emitSnapshotChange();
    void closing.then(emitSnapshotChange);
    return closing;
  }

  return Object.freeze({
    enqueue,
    resume,
    flush: internalQueue.flush,
    close,
    getSnapshot: internalQueue.getSnapshot,
  });
}

export {
  createDocumentAutosaveSession,
  isStrongHttpEntityTag,
} from './session.js';
export type {
  DocumentAutosaveDurableSaveFunction,
  DocumentAutosaveDurableSaveRequest,
  DocumentAutosaveDurableSaveResult,
  DocumentAutosaveSession,
  DocumentAutosaveSessionOptions,
  DocumentAutosaveSessionSnapshot,
} from './session.js';
