import {
  createReviewThreadPresentation,
  CwlReviewPresentationError,
  type CwlReviewThreadPresentation,
} from '../review/index.js';

/** Host-owned visible copy for Inkspan's bounded review-thread list. */
export interface CwlReviewThreadListLabels {
  /** Accessible name for the review region. */
  readonly region: string;
  /** Visible and accessible label for one validated thread. */
  readonly thread: (
    thread: CwlReviewThreadPresentation,
    index: number,
  ) => string;
  /** Visible label for the host-owned reply intent. */
  readonly reply: string;
  /** Visible label for the host-owned resolve intent. */
  readonly resolve: string;
}

/** Controlled inputs and intent callbacks for the review-thread list. */
export interface CwlReviewThreadListProps {
  /** Untrusted host presentation records validated before rendering. */
  readonly presentations: readonly unknown[];
  /** Host-supplied localized visible and accessible copy. */
  readonly labels: CwlReviewThreadListLabels;
  /** Selection intent; the host remains the controlled-state authority. */
  readonly onSelectThread: (thread: CwlReviewThreadPresentation) => void;
  /** Optional reply intent; absence keeps reply controls disabled. */
  readonly onReplyThread?: (thread: CwlReviewThreadPresentation) => void;
  /** Optional resolve intent; absence keeps resolve controls disabled. */
  readonly onResolveThread?: (thread: CwlReviewThreadPresentation) => void;
}

const REVIEW_LABEL_KEYS = ['region', 'thread', 'reply', 'resolve'] as const;
const MAX_REVIEW_LABEL_CODE_UNITS = 512;

type ReviewThreadLabelFactory = CwlReviewThreadListLabels['thread'];

interface ValidatedReviewThreadListLabels {
  readonly region: string;
  readonly thread: ReviewThreadLabelFactory;
  readonly reply: string;
  readonly resolve: string;
}

function rejectReviewPresentation(): never {
  throw new CwlReviewPresentationError();
}

function requireVisibleLabel(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > MAX_REVIEW_LABEL_CODE_UNITS
  ) {
    rejectReviewPresentation();
  }
  return value;
}

function validateReviewThreadListLabels(
  source: unknown,
): ValidatedReviewThreadListLabels {
  try {
    if (typeof source !== 'object' || source === null) {
      rejectReviewPresentation();
    }
    const ownKeys = Reflect.ownKeys(source);
    if (
      ownKeys.length !== REVIEW_LABEL_KEYS.length ||
      ownKeys.some(
        (key) =>
          typeof key !== 'string' ||
          !REVIEW_LABEL_KEYS.some((candidate) => candidate === key),
      )
    ) {
      rejectReviewPresentation();
    }

    const values: Record<string, unknown> = {};
    for (const key of REVIEW_LABEL_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        rejectReviewPresentation();
      }
      values[key] = descriptor.value;
    }

    if (typeof values.thread !== 'function') {
      rejectReviewPresentation();
    }
    return Object.freeze({
      region: requireVisibleLabel(values.region),
      thread: values.thread as ReviewThreadLabelFactory,
      reply: requireVisibleLabel(values.reply),
      resolve: requireVisibleLabel(values.resolve),
    });
  } catch {
    rejectReviewPresentation();
  }
}

function createThreadLabel(
  labelFactory: ReviewThreadLabelFactory,
  presentation: CwlReviewThreadPresentation,
  index: number,
): string {
  try {
    return requireVisibleLabel(labelFactory(presentation, index));
  } catch {
    rejectReviewPresentation();
  }
}

function validateReviewThreadPresentations(
  presentations: readonly unknown[],
): readonly CwlReviewThreadPresentation[] {
  try {
    if (!Array.isArray(presentations)) {
      throw new CwlReviewPresentationError();
    }

    const validatedPresentations = presentations.map((presentation) =>
      createReviewThreadPresentation(presentation),
    );
    const threadKeys = new Set<string>();
    for (const presentation of validatedPresentations) {
      if (threadKeys.has(presentation.threadKey)) {
        throw new CwlReviewPresentationError();
      }
      threadKeys.add(presentation.threadKey);
    }
    return validatedPresentations;
  } catch {
    throw new CwlReviewPresentationError();
  }
}

/**
 * Render a controlled accessible list of bounded review-thread presentations.
 *
 * Every source record passes through the React-free review validator before any
 * host metadata is rendered. Host labels must be exact enumerable data fields,
 * bounded non-empty visible strings, and one explicit thread-label function;
 * accessor-backed labels and thrown/private label failures are normalized to the
 * same redacted presentation error before React commits inaccessible content.
 * Repeated reply/resolve controls include the already validated thread label in
 * their accessible name so action lists remain disambiguated without changing
 * visible host copy. The component emits only intent callbacks with the
 * detached, frozen presentation snapshot; it does not authorize, persist,
 * transport, mutate, resolve, or reply to host-owned review records.
 */
export function CwlReviewThreadList({
  presentations,
  labels,
  onSelectThread,
  onReplyThread,
  onResolveThread,
}: CwlReviewThreadListProps) {
  const validatedPresentations =
    validateReviewThreadPresentations(presentations);
  const validatedLabels = validateReviewThreadListLabels(labels);

  return (
    <section aria-label={validatedLabels.region}>
      <ul>
        {validatedPresentations.map((presentation, index) => {
          const threadLabel = createThreadLabel(
            validatedLabels.thread,
            presentation,
            index,
          );
          const replyHandler =
            presentation.canReply && onReplyThread !== undefined
              ? () => onReplyThread(presentation)
              : undefined;
          const resolveHandler =
            presentation.state === 'unresolved' &&
            presentation.canResolve &&
            onResolveThread !== undefined
              ? () => onResolveThread(presentation)
              : undefined;

          return (
            <li key={presentation.threadKey}>
              <button
                type="button"
                aria-pressed={presentation.selected}
                onClick={() => onSelectThread(presentation)}
              >
                {threadLabel}
              </button>
              <button
                type="button"
                aria-label={`${validatedLabels.reply} — ${threadLabel}`}
                disabled={replyHandler === undefined}
                onClick={replyHandler}
              >
                {validatedLabels.reply}
              </button>
              <button
                type="button"
                aria-label={`${validatedLabels.resolve} — ${threadLabel}`}
                disabled={resolveHandler === undefined}
                onClick={resolveHandler}
              >
                {validatedLabels.resolve}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
