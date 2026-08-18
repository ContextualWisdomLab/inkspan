import type { CwlEditorDocumentRevisionEvidence } from '../documentRevisionEvidence.js';

/** Lifecycle states exposed by a document autosave queue snapshot. */
export type DocumentAutosaveQueueState =
  | 'idle'
  | 'saving'
  | 'blocked'
  | 'closing'
  | 'closed';

/** Reasons that require a host to make an explicit recovery decision. */
export type DocumentAutosaveBlockedReason = 'conflict' | 'failure';

/** Stable machine-readable categories for autosave queue errors. */
export type DocumentAutosaveQueueErrorCode =
  | 'invalid_options'
  | 'invalid_revision_evidence'
  | 'invalid_recovery_validator'
  | 'host_save_failed'
  | 'invalid_save_result';

/**
 * A redacted error raised when local validation or a host save operation fails.
 *
 * The queue deliberately omits the original exception, document body, revision
 * tag, credentials, tenant metadata, and callback result from the message. Host
 * applications may correlate their own private transport logs outside Inkspan.
 */
export class DocumentAutosaveQueueError extends Error {
  /** Stable category that callers can branch on without parsing the message. */
  readonly code: DocumentAutosaveQueueErrorCode;

  /**
   * Create one redacted queue error.
   *
   * Applications normally receive these errors from `enqueue()` rather than
   * constructing them directly.
   *
   * @param code - Stable machine-readable failure category.
   * @param message - Redacted beginner-readable explanation.
   */
  constructor(code: DocumentAutosaveQueueErrorCode, message: string) {
    super(message);
    this.name = 'DocumentAutosaveQueueError';
    this.code = code;
    Object.freeze(this);
  }
}

/** Result returned by a host-owned durable save callback. */
export type DocumentAutosaveSaveResult =
  | Readonly<{ status: 'saved' }>
  | Readonly<{ status: 'conflict' }>;

/**
 * Host-owned operation that attempts one authorized durable document write.
 *
 * Inkspan invokes this function at most once at a time. The host remains
 * responsible for transport, authorization, tenant isolation, persistence,
 * credentials, migration, retention, audit storage, retry budgets, and atomic
 * RFC 9110 `If-Match` enforcement.
 */
export type DocumentAutosaveSaveFunction = (
  evidence: CwlEditorDocumentRevisionEvidence,
) => DocumentAutosaveSaveResult | PromiseLike<DocumentAutosaveSaveResult>;

/** Options required to create a document autosave queue. */
export interface DocumentAutosaveQueueOptions {
  /** Host-owned operation used for every revision that becomes active. */
  readonly save: DocumentAutosaveSaveFunction;
}

/** Outcome for a revision that reached the host and was durably saved. */
export interface DocumentAutosaveSavedOutcome {
  /** Indicates that the host reported a successful durable write. */
  readonly status: 'saved';
  /** Strong equality validator for the submitted immutable evidence. */
  readonly strongEntityTag: string;
}

/** Outcome for a revision that is still known to be the durable queue revision. */
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
  /** Strong equality validator of the newer retained pending request. */
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
  /** Indicates that the request could not start after queue shutdown. */
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

/**
 * Immutable document-free lifecycle metadata for one autosave queue.
 *
 * Revision tags are tenant-confidential equality validators. The snapshot never
 * contains the document envelope, callback result, original error, credential,
 * transport response, or tenant identifier.
 */
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

/** Provider-neutral single-flight coordinator for immutable document evidence. */
export interface DocumentAutosaveQueue {
  /**
   * Queue one immutable revision for the host-owned save operation.
   *
   * Matching active or pending revisions share one promise. Re-enqueueing the
   * active revision supersedes a different pending revision because the active
   * callback will finish after the latest request. Any other newer revision
   * replaces only not-yet-started work; it never cancels or overlaps an active
   * host call. Invalid or unsupported-schema evidence fails synchronously before
   * it is stored.
   *
   * @param evidence - Frozen evidence returned by Inkspan revision APIs.
   * @returns A promise for the saved, unchanged, superseded, conflict, or closed outcome.
   */
  enqueue(
    evidence: CwlEditorDocumentRevisionEvidence,
  ): Promise<DocumentAutosaveRequestOutcome>;

  /**
   * Resume automatic progression after a conflict or callback failure.
   *
   * The host should call this only after completing its authenticated conflict
   * or operational recovery workflow. The queue never retries automatically.
   *
   * @returns `true` when a blocked state was cleared; otherwise `false`.
   */
  resume(): boolean;

  /**
   * Wait until the queue becomes idle, blocked, or closed.
   *
   * Concurrent callers share one pending promise, so the queue retains only one
   * internal flush waiter regardless of how often a host checks for quiescence.
   * A conflict or failure resolves the promise with a blocked snapshot.
   *
   * @returns The first terminal-for-flush immutable snapshot.
   */
  flush(): Promise<DocumentAutosaveQueueSnapshot>;

  /**
   * Reject new work, close pending work, and let an active host call finish.
   *
   * The queue never aborts host transport. Repeated calls are idempotent.
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

interface AutosaveRequest {
  readonly evidence: CwlEditorDocumentRevisionEvidence;
  readonly strongEntityTag: string;
  readonly promise: Promise<DocumentAutosaveRequestOutcome>;
  readonly resolve: (outcome: DocumentAutosaveRequestOutcome) => void;
  readonly reject: (error: DocumentAutosaveQueueError) => void;
}

type QueueLifecycle = 'open' | 'closing' | 'closed';
type ExactDataRecord = Record<string, unknown>;

const SUPPORTED_DOCUMENT_ENVELOPE_SCHEMA_ID =
  'https://inkspan.io/schemas/document-envelope/v1';
const SUPPORTED_DOCUMENT_ENVELOPE_SCHEMA_VERSION = 1;
const LOWERCASE_SHA256_DIGEST = /^[0-9a-f]{64}$/u;

/** Create a redacted invalid-options error. */
function createInvalidOptionsError(): DocumentAutosaveQueueError {
  return new DocumentAutosaveQueueError(
    'invalid_options',
    'Document autosave queue options are invalid.',
  );
}

/** Create a redacted invalid-evidence error. */
function createInvalidEvidenceError(): DocumentAutosaveQueueError {
  return new DocumentAutosaveQueueError(
    'invalid_revision_evidence',
    'Document revision evidence is invalid.',
  );
}

/** Create a redacted host-callback error. */
function createHostSaveError(): DocumentAutosaveQueueError {
  return new DocumentAutosaveQueueError(
    'host_save_failed',
    'The host save operation failed.',
  );
}

/** Create a redacted invalid-callback-result error. */
function createInvalidSaveResultError(): DocumentAutosaveQueueError {
  return new DocumentAutosaveQueueError(
    'invalid_save_result',
    'The host save operation returned an invalid result.',
  );
}

/**
 * Read exact enumerable data properties without evaluating accessors.
 *
 * Returning `null` instead of propagating reflection failures prevents hostile
 * proxies or getters from copying private source values into public errors.
 */
function readExactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
  requireFrozen: boolean,
): ExactDataRecord | null {
  try {
    if (typeof value !== 'object' || value === null) return null;
    if (requireFrozen && !Object.isFrozen(value)) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some(
        (key) =>
          typeof key !== 'string' || !expectedKeys.includes(key),
      )
    ) {
      return null;
    }
    const result: ExactDataRecord = {};
    for (const expectedKey of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, expectedKey);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        return null;
      }
      result[expectedKey] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

/** Validate and extract the host save function from exact options. */
function readSaveFunction(
  options: DocumentAutosaveQueueOptions,
): DocumentAutosaveSaveFunction {
  const record = readExactDataRecord(options, ['save'], false);
  if (record === null || typeof record.save !== 'function') {
    throw createInvalidOptionsError();
  }
  return record.save as DocumentAutosaveSaveFunction;
}

/** Validate immutable evidence metadata without reading document text. */
function readStrongEntityTag(
  evidence: CwlEditorDocumentRevisionEvidence,
): string {
  const evidenceRecord = readExactDataRecord(
    evidence,
    ['envelope', 'revision'],
    true,
  );
  if (evidenceRecord === null) throw createInvalidEvidenceError();

  const envelopeRecord = readExactDataRecord(
    evidenceRecord.envelope,
    ['schemaId', 'schemaVersion', 'documentJson'],
    true,
  );
  if (
    envelopeRecord === null ||
    envelopeRecord.schemaId !== SUPPORTED_DOCUMENT_ENVELOPE_SCHEMA_ID ||
    envelopeRecord.schemaVersion !==
      SUPPORTED_DOCUMENT_ENVELOPE_SCHEMA_VERSION ||
    typeof envelopeRecord.documentJson !== 'object' ||
    envelopeRecord.documentJson === null ||
    !Object.isFrozen(envelopeRecord.documentJson)
  ) {
    throw createInvalidEvidenceError();
  }

  const revisionRecord = readExactDataRecord(
    evidenceRecord.revision,
    ['algorithm', 'digestHex', 'strongEntityTag'],
    true,
  );
  if (
    revisionRecord === null ||
    revisionRecord.algorithm !== 'SHA-256' ||
    typeof revisionRecord.digestHex !== 'string' ||
    revisionRecord.digestHex.length !== 64 ||
    !LOWERCASE_SHA256_DIGEST.test(revisionRecord.digestHex) ||
    typeof revisionRecord.strongEntityTag !== 'string' ||
    revisionRecord.strongEntityTag !==
      `"sha256-${revisionRecord.digestHex}"`
  ) {
    throw createInvalidEvidenceError();
  }
  return revisionRecord.strongEntityTag;
}

/** Validate one exact host callback result without evaluating accessors. */
function readSaveStatus(value: unknown): 'saved' | 'conflict' | null {
  const result = readExactDataRecord(value, ['status'], false);
  return result !== null &&
    (result.status === 'saved' || result.status === 'conflict')
    ? result.status
    : null;
}

/** Create one request and its shared settlement promise. */
function createRequest(
  evidence: CwlEditorDocumentRevisionEvidence,
  strongEntityTag: string,
): AutosaveRequest {
  let resolve!: (outcome: DocumentAutosaveRequestOutcome) => void;
  let reject!: (error: DocumentAutosaveQueueError) => void;
  const promise = new Promise<DocumentAutosaveRequestOutcome>(
    (promiseResolve, promiseReject) => {
      resolve = promiseResolve;
      reject = promiseReject;
    },
  );
  return { evidence, strongEntityTag, promise, resolve, reject };
}

/** Resolve one queued request. */
function resolveRequest(
  request: AutosaveRequest,
  outcome: DocumentAutosaveRequestOutcome,
): void {
  request.resolve(outcome);
}

/** Reject one queued request with a redacted queue error. */
function rejectRequest(
  request: AutosaveRequest,
  error: DocumentAutosaveQueueError,
): void {
  request.reject(error);
}

/** Create a frozen two-field request outcome. */
function createSimpleOutcome<
  Status extends 'saved' | 'unchanged' | 'conflict' | 'closed',
>(
  status: Status,
  strongEntityTag: string,
): Readonly<{ status: Status; strongEntityTag: string }> {
  return Object.freeze({ status, strongEntityTag });
}

/** Create a frozen supersession outcome that contains no document data. */
function createSupersededOutcome(
  strongEntityTag: string,
  supersededByStrongEntityTag: string,
): DocumentAutosaveSupersededOutcome {
  return Object.freeze({
    status: 'superseded',
    strongEntityTag,
    supersededByStrongEntityTag,
  });
}

/**
 * Create a provider-neutral single-flight document autosave queue.
 *
 * The queue owns only local ordering and lifecycle coordination. It does not
 * debounce changes, perform network requests, authorize users, select tenants,
 * write storage, retain audit records, migrate schemas, or resolve conflicts.
 * It retains at most one active request, one pending request, and one shared
 * pending flush promise.
 *
 * @param options - Exact object containing the host-owned save callback.
 * @returns A frozen queue interface with no provider or framework dependency.
 * @throws {DocumentAutosaveQueueError} When options are malformed.
 */
export function createDocumentAutosaveQueue(
  options: DocumentAutosaveQueueOptions,
): DocumentAutosaveQueue {
  const save = readSaveFunction(options);
  let lifecycle: QueueLifecycle = 'open';
  let blockedReason: DocumentAutosaveBlockedReason | null = null;
  let activeRequest: AutosaveRequest | null = null;
  let pendingRequest: AutosaveRequest | null = null;
  let lastSavedStrongEntityTag: string | null = null;
  let lastSavedShortcutValid = false;
  let pumpRunning = false;
  let flushPromise: Promise<DocumentAutosaveQueueSnapshot> | null = null;
  let resolveFlushPromise:
    | ((snapshot: DocumentAutosaveQueueSnapshot) => void)
    | null = null;

  /** Derive the externally visible state from private queue fields. */
  function readState(): DocumentAutosaveQueueState {
    if (lifecycle === 'closed') return 'closed';
    if (lifecycle === 'closing') return 'closing';
    if (blockedReason !== null) return 'blocked';
    if (activeRequest !== null) return 'saving';
    return 'idle';
  }

  /** Create one frozen document-free snapshot. */
  function getSnapshot(): DocumentAutosaveQueueSnapshot {
    return Object.freeze({
      state: readState(),
      blockedReason,
      activeStrongEntityTag: activeRequest?.strongEntityTag ?? null,
      pendingStrongEntityTag: pendingRequest?.strongEntityTag ?? null,
      lastSavedStrongEntityTag,
    });
  }

  /** Finish shutdown once no host callback remains active. */
  function finishClosingIfPossible(): void {
    if (lifecycle === 'closing' && activeRequest === null) {
      lifecycle = 'closed';
    }
  }

  /** Report whether `flush()` may resolve at the current local state. */
  function isFlushTerminal(): boolean {
    if (lifecycle === 'closed') return true;
    if (lifecycle !== 'open') return false;
    if (blockedReason !== null) return true;
    return (
      activeRequest === null &&
      pendingRequest === null &&
      !pumpRunning
    );
  }

  /** Resolve the one shared pending flush promise when state is terminal. */
  function settleFlushPromise(): void {
    finishClosingIfPossible();
    if (!isFlushTerminal() || resolveFlushPromise === null) return;
    const resolve = resolveFlushPromise;
    const snapshot = getSnapshot();
    resolveFlushPromise = null;
    flushPromise = null;
    resolve(snapshot);
  }

  /** Resolve and release not-yet-started work during shutdown. */
  function closePendingRequest(): void {
    if (pendingRequest === null) return;
    const request = pendingRequest;
    pendingRequest = null;
    resolveRequest(
      request,
      createSimpleOutcome('closed', request.strongEntityTag),
    );
  }

  /** Block automatic progression after an active callback failure. */
  function failActiveRequest(
    request: AutosaveRequest,
    error: DocumentAutosaveQueueError,
  ): void {
    activeRequest = null;
    lastSavedShortcutValid = false;
    rejectRequest(request, error);
    if (lifecycle === 'open') blockedReason = 'failure';
  }

  /** Drain retained work without overlapping host callback invocations. */
  async function drainQueue(): Promise<void> {
    try {
      while (
        lifecycle === 'open' &&
        blockedReason === null &&
        pendingRequest !== null
      ) {
        const request = pendingRequest;
        pendingRequest = null;
        activeRequest = request;

        let callbackResult: unknown;
        try {
          callbackResult = await save(request.evidence);
        } catch {
          failActiveRequest(request, createHostSaveError());
          return;
        }

        const saveStatus = readSaveStatus(callbackResult);
        if (saveStatus === null) {
          failActiveRequest(request, createInvalidSaveResultError());
          return;
        }

        activeRequest = null;
        if (saveStatus === 'saved') {
          lastSavedStrongEntityTag = request.strongEntityTag;
          lastSavedShortcutValid = true;
          resolveRequest(
            request,
            createSimpleOutcome('saved', request.strongEntityTag),
          );
        } else {
          lastSavedShortcutValid = false;
          resolveRequest(
            request,
            createSimpleOutcome('conflict', request.strongEntityTag),
          );
          if (lifecycle === 'open') blockedReason = 'conflict';
        }

        if (lifecycle !== 'open' || saveStatus === 'conflict') return;
      }
    } finally {
      pumpRunning = false;
      finishClosingIfPossible();
      settleFlushPromise();
    }
  }

  /** Start the drain loop only when eligible work exists. */
  function startPump(): void {
    if (
      pumpRunning ||
      lifecycle !== 'open' ||
      blockedReason !== null ||
      pendingRequest === null
    ) {
      settleFlushPromise();
      return;
    }
    pumpRunning = true;
    void drainQueue();
  }

  /** Queue, coalesce, supersede, or reject one immutable revision. */
  function enqueue(
    evidence: CwlEditorDocumentRevisionEvidence,
  ): Promise<DocumentAutosaveRequestOutcome> {
    const strongEntityTag = readStrongEntityTag(evidence);
    if (lifecycle !== 'open') {
      return Promise.resolve(
        createSimpleOutcome('closed', strongEntityTag),
      );
    }
    if (activeRequest?.strongEntityTag === strongEntityTag) {
      if (pendingRequest !== null) {
        const supersededRequest = pendingRequest;
        pendingRequest = null;
        resolveRequest(
          supersededRequest,
          createSupersededOutcome(
            supersededRequest.strongEntityTag,
            strongEntityTag,
          ),
        );
      }
      return activeRequest.promise;
    }
    if (pendingRequest?.strongEntityTag === strongEntityTag) {
      return pendingRequest.promise;
    }
    if (
      lastSavedShortcutValid &&
      blockedReason === null &&
      activeRequest === null &&
      pendingRequest === null &&
      lastSavedStrongEntityTag === strongEntityTag
    ) {
      return Promise.resolve(
        createSimpleOutcome('unchanged', strongEntityTag),
      );
    }

    const nextRequest = createRequest(evidence, strongEntityTag);
    if (pendingRequest !== null) {
      const supersededRequest = pendingRequest;
      pendingRequest = nextRequest;
      resolveRequest(
        supersededRequest,
        createSupersededOutcome(
          supersededRequest.strongEntityTag,
          strongEntityTag,
        ),
      );
    } else {
      pendingRequest = nextRequest;
    }
    startPump();
    return nextRequest.promise;
  }

  /** Clear one explicit blocked state and continue retained work. */
  function resume(): boolean {
    if (lifecycle !== 'open' || blockedReason === null) return false;
    blockedReason = null;
    startPump();
    settleFlushPromise();
    return true;
  }

  /** Wait for idle, blocked, or closed local state using one shared promise. */
  function flush(): Promise<DocumentAutosaveQueueSnapshot> {
    finishClosingIfPossible();
    if (isFlushTerminal()) return Promise.resolve(getSnapshot());
    if (flushPromise !== null) return flushPromise;
    flushPromise = new Promise<DocumentAutosaveQueueSnapshot>((resolve) => {
      resolveFlushPromise = resolve;
    });
    return flushPromise;
  }

  /** Begin idempotent shutdown without aborting active host transport. */
  function close(): Promise<DocumentAutosaveQueueSnapshot> {
    if (lifecycle === 'open') {
      lifecycle = 'closing';
      blockedReason = null;
      closePendingRequest();
      finishClosingIfPossible();
      settleFlushPromise();
    }
    return flush();
  }

  return Object.freeze({
    enqueue,
    resume,
    flush,
    close,
    getSnapshot,
  });
}
