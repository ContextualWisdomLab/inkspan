import {
  DocumentAutosaveQueueError,
  createDocumentAutosaveQueue as createInternalDocumentAutosaveQueue,
  type DocumentAutosaveQueueSnapshot as InternalQueueSnapshot,
} from './index.js';
import { createDetachedAutosaveRevisionEvidence } from './evidenceValidation.js';
import type {
  DocumentAutosaveQueueSnapshot,
  DocumentAutosaveRequestOutcome,
  DocumentAutosaveRevisionEvidence,
  DocumentAutosaveSaveResult,
} from './package.js';

/** Immutable input supplied to one host-owned durable save operation. */
export interface DocumentAutosaveDurableSaveRequest {
  /** Detached, deeply frozen document revision proposed for persistence. */
  readonly evidence: DocumentAutosaveRevisionEvidence;
  /** Server-issued strong entity tag that the host must send as `If-Match`. */
  readonly ifMatchStrongEntityTag: string;
}

/** Result returned after one host-owned durable compare-and-swap attempt. */
export type DocumentAutosaveDurableSaveResult =
  | Readonly<{
      /** Indicates that the authorized durable write committed. */
      status: 'saved';
      /** Strong entity tag selected by the server for the committed representation. */
      nextStrongEntityTag: string;
    }>
  | Readonly<{
      /** Indicates that the durable base validator no longer matched. */
      status: 'conflict';
    }>;

/**
 * Host-owned durable save operation with an explicit optimistic-concurrency base.
 *
 * The host must enforce `ifMatchStrongEntityTag` atomically inside its authorized
 * storage transaction and return the server-selected strong entity tag for the
 * resulting representation. Inkspan never performs transport or persistence.
 * The host must also bound its own callback with a timeout or abort signal:
 * an unresolved callback retains the single-flight request and prevents later
 * enqueue, flush, and close operations from completing. Retry policy remains
 * host-owned.
 */
export type DocumentAutosaveDurableSaveFunction = (
  request: Readonly<DocumentAutosaveDurableSaveRequest>,
) =>
  | DocumentAutosaveDurableSaveResult
  | PromiseLike<DocumentAutosaveDurableSaveResult>;

/** Options required to create a durable-validator autosave session. */
export interface DocumentAutosaveSessionOptions {
  /** Strong entity tag returned with the durable representation initially loaded. */
  readonly initialStrongEntityTag: string;
  /** Host-owned authorized compare-and-swap operation. */
  readonly save: DocumentAutosaveDurableSaveFunction;
  /**
   * Optional bounded observer invoked after distinct session lifecycle changes.
   *
   * Inkspan retains only this callback, never invokes it during construction,
   * and ignores callback exceptions. The emitted snapshot contains lifecycle
   * metadata and the current durable validator, but never a document body.
   */
  readonly onSnapshotChange?: (
    snapshot: DocumentAutosaveSessionSnapshot,
  ) => void;
}

/** Frozen document-free lifecycle metadata for one durable autosave session. */
export interface DocumentAutosaveSessionSnapshot
  extends DocumentAutosaveQueueSnapshot {
  /** Server-issued strong entity tag used by the next durable save request. */
  readonly durableStrongEntityTag: string;
}

/**
 * Provider-neutral autosave coordinator that owns durable validator handoff.
 *
 * The session combines the bounded single-flight queue with one server-issued
 * strong entity tag. It never substitutes Inkspan's local content revision for
 * the durable HTTP validator and never advances the durable validator after a
 * conflict, malformed callback result, or ambiguous transport failure.
 */
export interface DocumentAutosaveSession {
  /**
   * Queue one immutable revision for the host-owned durable save operation.
   *
   * @param evidence - Frozen evidence returned by Inkspan revision APIs.
   * @returns A promise for the deterministic local request outcome.
   */
  enqueue(
    evidence: DocumentAutosaveRevisionEvidence,
  ): Promise<DocumentAutosaveRequestOutcome>;
  /**
   * Resume a blocked session with the strong entity tag obtained by recovery.
   *
   * The replacement validator must come from an authenticated durable reload,
   * compare/merge/fork decision, or idempotency confirmation. It is installed
   * immediately before retained work resumes, so the next callback observes the
   * exact recovered base.
   *
   * @param nextStrongEntityTag - Server-issued strong validator after recovery.
   * @returns `true` when one blocked state was cleared; otherwise `false`.
   * @throws {DocumentAutosaveQueueError} With code
   * `invalid_recovery_validator` when the recovered value is not one
   * syntactically valid strong entity tag.
   */
  resume(nextStrongEntityTag: string): boolean;
  /**
   * Wait until the session becomes idle, blocked, or closed.
   *
   * @returns A frozen document-free session snapshot.
   */
  flush(): Promise<DocumentAutosaveSessionSnapshot>;
  /**
   * Reject new work, close pending work, and let active transport finish.
   *
   * @returns The final frozen document-free session snapshot.
   */
  close(): Promise<DocumentAutosaveSessionSnapshot>;
  /**
   * Read current document-free lifecycle and durable-validator metadata.
   *
   * @returns A newly created immutable session snapshot.
   */
  getSnapshot(): DocumentAutosaveSessionSnapshot;
}

interface InternalQueueAdapter {
  readonly enqueue: (
    evidence: DocumentAutosaveRevisionEvidence,
  ) => Promise<DocumentAutosaveRequestOutcome>;
  readonly resume: () => boolean;
  readonly flush: () => Promise<InternalQueueSnapshot>;
  readonly close: () => Promise<InternalQueueSnapshot>;
  readonly getSnapshot: () => InternalQueueSnapshot;
}

const STRONG_HTTP_ENTITY_TAG =
  /^"[\u0021\u0023-\u007e\u0080-\u00ff]*"$/u;
const MAX_STRONG_HTTP_ENTITY_TAG_CODE_UNITS = 64 * 1024;
const DOCUMENT_AUTOSAVE_SESSION_OPTION_KEYS = [
  'initialStrongEntityTag',
  'save',
  'onSnapshotChange',
] as const;

/**
 * Determine whether a value is one resource-bounded RFC 9110 strong entity tag.
 *
 * The check accepts exactly one quoted opaque tag up to Inkspan's 64 Ki complete
 * validator ceiling, rejects oversized values before regex evaluation, and then
 * rejects the `W/` weak prefix, whitespace, control characters, Unicode outside
 * the HTTP `obs-text` range, lists, wildcards, and unquoted values. The size
 * ceiling is Inkspan local resource policy rather than an RFC field-size claim;
 * accepted input is never trimmed or repaired.
 *
 * @param candidate - Unknown value obtained from a durable service boundary.
 * @returns `true` only for one in-bound syntactically strong entity tag.
 */
export function isStrongHttpEntityTag(candidate: unknown): candidate is string {
  if (typeof candidate !== 'string') return false;
  if (candidate.length > MAX_STRONG_HTTP_ENTITY_TAG_CODE_UNITS) return false;
  return STRONG_HTTP_ENTITY_TAG.test(candidate);
}

/** Create one redacted invalid-session-options error. */
function createInvalidSessionOptionsError(): DocumentAutosaveQueueError {
  return new DocumentAutosaveQueueError(
    'invalid_options',
    'Document autosave session options are invalid.',
  );
}

/** Create one redacted invalid-recovery-validator error. */
function createInvalidRecoveryValidatorError(): DocumentAutosaveQueueError {
  return new DocumentAutosaveQueueError(
    'invalid_recovery_validator',
    'The recovered durable strong entity tag is invalid.',
  );
}

/**
 * Read exact enumerable session option values without evaluating accessors.
 *
 * The descriptor-only boundary rejects unknown fields, symbols, accessors,
 * non-enumerable fields, and hostile reflection while accepting transparent
 * proxies whose target owns the required data fields and optional observer.
 */
function readDocumentAutosaveSessionOptions(
  options: DocumentAutosaveSessionOptions,
): Readonly<{
  initialStrongEntityTag: string;
  save: DocumentAutosaveDurableSaveFunction;
  onSnapshotChange: ((snapshot: DocumentAutosaveSessionSnapshot) => void) | null;
}> {
  try {
    if (typeof options !== 'object' || options === null) {
      throw createInvalidSessionOptionsError();
    }
    const optionKeys = Reflect.ownKeys(options);
    if (
      optionKeys.length < 2 ||
      optionKeys.length > DOCUMENT_AUTOSAVE_SESSION_OPTION_KEYS.length ||
      optionKeys.some(
        (optionKey) =>
          typeof optionKey !== 'string' ||
          !DOCUMENT_AUTOSAVE_SESSION_OPTION_KEYS.includes(
            optionKey as (typeof DOCUMENT_AUTOSAVE_SESSION_OPTION_KEYS)[number],
          ),
      )
    ) {
      throw createInvalidSessionOptionsError();
    }
    const initialStrongEntityTagDescriptor = Object.getOwnPropertyDescriptor(
      options,
      'initialStrongEntityTag',
    );
    const saveDescriptor = Object.getOwnPropertyDescriptor(options, 'save');
    const observerDescriptor = Object.getOwnPropertyDescriptor(
      options,
      'onSnapshotChange',
    );
    if (
      initialStrongEntityTagDescriptor === undefined ||
      saveDescriptor === undefined ||
      !initialStrongEntityTagDescriptor.enumerable ||
      !saveDescriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(
        initialStrongEntityTagDescriptor,
        'value',
      ) ||
      !Object.prototype.hasOwnProperty.call(saveDescriptor, 'value') ||
      (observerDescriptor !== undefined &&
        (!observerDescriptor.enumerable ||
          !Object.prototype.hasOwnProperty.call(observerDescriptor, 'value') ||
          typeof observerDescriptor.value !== 'function'))
    ) {
      throw createInvalidSessionOptionsError();
    }
    const initialStrongEntityTag = initialStrongEntityTagDescriptor.value;
    const save = saveDescriptor.value;
    if (!isStrongHttpEntityTag(initialStrongEntityTag) || typeof save !== 'function') {
      throw createInvalidSessionOptionsError();
    }
    return Object.freeze({
      initialStrongEntityTag,
      save,
      onSnapshotChange:
        observerDescriptor === undefined
          ? null
          : (observerDescriptor.value as (
              snapshot: DocumentAutosaveSessionSnapshot,
            ) => void),
    });
  } catch {
    throw createInvalidSessionOptionsError();
  }
}

/** Read one exact durable callback result without evaluating accessors. */
function readDurableSaveResult(
  value: unknown,
): DocumentAutosaveDurableSaveResult | null {
  try {
    if (typeof value !== 'object' || value === null) return null;
    const statusDescriptor = Object.getOwnPropertyDescriptor(value, 'status');
    if (
      statusDescriptor === undefined ||
      !statusDescriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(statusDescriptor, 'value') ||
      (statusDescriptor.value !== 'conflict' && statusDescriptor.value !== 'saved')
    ) {
      return null;
    }
    if (statusDescriptor.value === 'saved') {
      const nextDescriptor = Object.getOwnPropertyDescriptor(
        value,
        'nextStrongEntityTag',
      );
      if (
        nextDescriptor === undefined ||
        !nextDescriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(nextDescriptor, 'value') ||
        !isStrongHttpEntityTag(nextDescriptor.value)
      ) {
        return null;
      }
      const keys = Reflect.ownKeys(value);
      if (
        keys.length !== 2 ||
        !keys.includes('status') ||
        !keys.includes('nextStrongEntityTag')
      ) {
        return null;
      }
      return Object.freeze({
        status: 'saved',
        nextStrongEntityTag: nextDescriptor.value,
      });
    }
    const keys = Reflect.ownKeys(value);
    return keys.length === 1 && keys[0] === 'status'
      ? Object.freeze({ status: 'conflict' })
      : null;
  } catch {
    return null;
  }
}

/** Create one invalid internal callback sentinel without private source values. */
function createInvalidDurableSaveSentinel(): DocumentAutosaveSaveResult {
  return Object.freeze({ status: 'invalid' }) as never;
}

/** Combine queue lifecycle metadata with the current durable validator. */
function createDocumentAutosaveSessionSnapshot(
  queueSnapshot: DocumentAutosaveQueueSnapshot,
  durableStrongEntityTag: string,
): DocumentAutosaveSessionSnapshot {
  return Object.freeze({
    ...queueSnapshot,
    durableStrongEntityTag,
  });
}

/** Report whether one current queue snapshot is terminal for session flushing. */
function isSessionFlushTerminal(snapshot: InternalQueueSnapshot): boolean {
  return (
    snapshot.state === 'idle' ||
    snapshot.state === 'blocked' ||
    snapshot.state === 'closed'
  );
}

/**
 * Create a provider-neutral durable-validator autosave session.
 *
 * The session validates the initially loaded server entity tag, supplies that
 * validator to exactly one host callback at a time, and advances it only after a
 * syntactically valid `saved` result supplies the server's replacement tag.
 * Conflict and failure recovery remain host-owned and explicit through
 * `resume(nextStrongEntityTag)`. An optional observer receives distinct frozen
 * document-free snapshots after the durable validator and queue state agree.
 *
 * @param options - Initial server validator, save callback, and optional observer.
 * @returns A frozen standalone autosave session with no framework dependency.
 * @throws {DocumentAutosaveQueueError} When options are malformed.
 */
export function createDocumentAutosaveSession(
  options: DocumentAutosaveSessionOptions,
): DocumentAutosaveSession {
  const validatedOptions = readDocumentAutosaveSessionOptions(options);
  let durableStrongEntityTag = validatedOptions.initialStrongEntityTag;
  let lastObservedSnapshotJson: string | null = null;
  const observedRequestSettlements = new WeakSet<
    Promise<DocumentAutosaveRequestOutcome>
  >();
  const internalQueue = createInternalDocumentAutosaveQueue({
    async save(internalEvidence) {
      const evidence =
        internalEvidence as unknown as DocumentAutosaveRevisionEvidence;
      const result = await validatedOptions.save(
        Object.freeze({
          evidence,
          ifMatchStrongEntityTag: durableStrongEntityTag,
        }),
      );
      const validatedResult = readDurableSaveResult(result);
      if (validatedResult === null) return createInvalidDurableSaveSentinel();
      if (validatedResult.status === 'conflict') return validatedResult;
      durableStrongEntityTag = validatedResult.nextStrongEntityTag;
      return Object.freeze({ status: 'saved' });
    },
  }) as unknown as InternalQueueAdapter;

  /** Create a current document-free snapshot. */
  function getSnapshot(): DocumentAutosaveSessionSnapshot {
    return createDocumentAutosaveSessionSnapshot(
      internalQueue.getSnapshot() as DocumentAutosaveQueueSnapshot,
      durableStrongEntityTag,
    );
  }

  /** Notify the retained observer only after distinct coherent state changes. */
  function emitSnapshotChange(): void {
    if (validatedOptions.onSnapshotChange === null) return;
    const snapshot = getSnapshot();
    const snapshotJson = JSON.stringify(snapshot);
    if (snapshotJson === lastObservedSnapshotJson) return;
    lastObservedSnapshotJson = snapshotJson;
    try {
      validatedOptions.onSnapshotChange(snapshot);
    } catch {
      // Presentation/telemetry failures cannot alter validator or queue state.
    }
  }

  /** Observe eventual queue settlement at most once per shared promise. */
  function observeRequestSettlement(
    request: Promise<DocumentAutosaveRequestOutcome>,
  ): void {
    if (observedRequestSettlements.has(request)) return;
    observedRequestSettlements.add(request);
    void request.then(emitSnapshotChange, emitSnapshotChange);
  }

  /** Queue one detached immutable revision. */
  function enqueue(
    evidence: DocumentAutosaveRevisionEvidence,
  ): Promise<DocumentAutosaveRequestOutcome> {
    const detachedEvidence = createDetachedAutosaveRevisionEvidence(evidence);
    if (detachedEvidence === null) {
      throw new DocumentAutosaveQueueError(
        'invalid_revision_evidence',
        'Document revision evidence is invalid.',
      );
    }
    const request = internalQueue.enqueue(detachedEvidence);
    emitSnapshotChange();
    observeRequestSettlement(request);
    return request;
  }

  /** Resume blocked work only after installing a valid recovered validator. */
  function resume(nextStrongEntityTag: string): boolean {
    if (!isStrongHttpEntityTag(nextStrongEntityTag)) {
      throw createInvalidRecoveryValidatorError();
    }
    if (internalQueue.getSnapshot().state !== 'blocked') return false;

    // `internalQueue.resume()` starts retained work synchronously until the first
    // host await. Install the recovered validator before that call, but restore
    // the previous value if the queue unexpectedly declines the transition.
    const previousStrongEntityTag = durableStrongEntityTag;
    durableStrongEntityTag = nextStrongEntityTag;
    const resumed = internalQueue.resume();
    if (!resumed) durableStrongEntityTag = previousStrongEntityTag;
    emitSnapshotChange();
    return resumed;
  }

  /** Wait for the current terminal state and attach its durable validator. */
  async function flush(): Promise<DocumentAutosaveSessionSnapshot> {
    await internalQueue.flush();
    while (true) {
      const snapshot = internalQueue.getSnapshot();
      if (isSessionFlushTerminal(snapshot)) {
        return createDocumentAutosaveSessionSnapshot(
          snapshot as DocumentAutosaveQueueSnapshot,
          durableStrongEntityTag,
        );
      }
      await internalQueue.flush();
    }
  }

  /** Close queue progression and attach the final durable validator. */
  async function close(): Promise<DocumentAutosaveSessionSnapshot> {
    const closing = internalQueue.close();
    emitSnapshotChange();
    const snapshot = await closing;
    emitSnapshotChange();
    return createDocumentAutosaveSessionSnapshot(
      snapshot as DocumentAutosaveQueueSnapshot,
      durableStrongEntityTag,
    );
  }

  return Object.freeze({
    enqueue,
    resume,
    flush,
    close,
    getSnapshot,
  });
}
