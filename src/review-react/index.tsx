import { useId, useRef } from 'react';
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
  /** Optional visible status summary. Must be paired with `comments`. */
  readonly status?: (
    thread: CwlReviewThreadPresentation,
    index: number,
  ) => string;
  /** Optional visible comment-count summary. Must be paired with `status`. */
  readonly comments?: (
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
const REVIEW_SUMMARY_LABEL_KEYS = ['status', 'comments'] as const;
const MAX_REVIEW_LABEL_CODE_UNITS = 512;
const MAX_REVIEW_THREAD_PRESENTATIONS = 1_024;

type ReviewThreadLabelFactory = CwlReviewThreadListLabels['thread'];
type ReviewThreadStatusLabelFactory = NonNullable<
  CwlReviewThreadListLabels['status']
>;
type ReviewThreadCommentsLabelFactory = NonNullable<
  CwlReviewThreadListLabels['comments']
>;
type ReviewIntentCallback = CwlReviewThreadListProps['onSelectThread'];

interface ValidatedReviewThreadListLabels {
  readonly region: string;
  readonly thread: ReviewThreadLabelFactory;
  readonly status: ReviewThreadStatusLabelFactory | undefined;
  readonly comments: ReviewThreadCommentsLabelFactory | undefined;
  readonly reply: string;
  readonly resolve: string;
}

interface ValidatedReviewIntentCallbacks {
  readonly onSelectThread: ReviewIntentCallback;
  readonly onReplyThread: ReviewIntentCallback | undefined;
  readonly onResolveThread: ReviewIntentCallback | undefined;
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
    const allowedKeys = [...REVIEW_LABEL_KEYS, ...REVIEW_SUMMARY_LABEL_KEYS];
    const hasSummaryLabels =
      ownKeys.length === allowedKeys.length &&
      REVIEW_SUMMARY_LABEL_KEYS.every((key) => ownKeys.includes(key));
    if (
      (ownKeys.length !== REVIEW_LABEL_KEYS.length && !hasSummaryLabels) ||
      ownKeys.some(
        (key) =>
          typeof key !== 'string' ||
          !allowedKeys.some((candidate) => candidate === key),
      )
    ) {
      rejectReviewPresentation();
    }

    const expectedKeys = hasSummaryLabels ? allowedKeys : REVIEW_LABEL_KEYS;
    const values: Record<string, unknown> = {};
    for (const key of expectedKeys) {
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

    if (
      typeof values.thread !== 'function' ||
      (hasSummaryLabels &&
        (typeof values.status !== 'function' ||
          typeof values.comments !== 'function'))
    ) {
      rejectReviewPresentation();
    }
    return Object.freeze({
      region: requireVisibleLabel(values.region),
      thread: values.thread as ReviewThreadLabelFactory,
      status: hasSummaryLabels
        ? (values.status as ReviewThreadStatusLabelFactory)
        : undefined,
      comments: hasSummaryLabels
        ? (values.comments as ReviewThreadCommentsLabelFactory)
        : undefined,
      reply: requireVisibleLabel(values.reply),
      resolve: requireVisibleLabel(values.resolve),
    });
  } catch {
    rejectReviewPresentation();
  }
}

function validateReviewIntentCallbacks(
  onSelectThread: unknown,
  onReplyThread: unknown,
  onResolveThread: unknown,
): ValidatedReviewIntentCallbacks {
  if (typeof onSelectThread !== 'function') {
    rejectReviewPresentation();
  }
  if (onReplyThread !== undefined && typeof onReplyThread !== 'function') {
    rejectReviewPresentation();
  }
  if (onResolveThread !== undefined && typeof onResolveThread !== 'function') {
    rejectReviewPresentation();
  }
  return Object.freeze({
    onSelectThread: onSelectThread as ReviewIntentCallback,
    onReplyThread: onReplyThread as ReviewIntentCallback | undefined,
    onResolveThread: onResolveThread as ReviewIntentCallback | undefined,
  });
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

function createThreadSummaryLabel(
  labelFactory:
    | ReviewThreadStatusLabelFactory
    | ReviewThreadCommentsLabelFactory,
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
    if (
      !Array.isArray(presentations) ||
      presentations.length > MAX_REVIEW_THREAD_PRESENTATIONS
    ) {
      throw new CwlReviewPresentationError();
    }

    const validatedPresentations: CwlReviewThreadPresentation[] = [];
    for (let index = 0; index < presentations.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(
        presentations,
        String(index),
      );
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw new CwlReviewPresentationError();
      }
      validatedPresentations.push(
        createReviewThreadPresentation(descriptor.value),
      );
    }

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

function reviewThreadFocusIndex(
  key: string,
  index: number,
  lastIndex: number,
): number | undefined {
  switch (key) {
    case 'ArrowDown':
      return Math.min(index + 1, lastIndex);
    case 'ArrowUp':
      return Math.max(index - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return lastIndex;
    default:
      return undefined;
  }
}

/**
 * Render a controlled accessible list of bounded review-thread presentations.
 *
 * The collection is capped before any item inspection. Every array slot must be
 * a dense enumerable data property, so accessor-backed or sparse host entries
 * fail closed without invoking host accessors before the React-free review
 * validator inspects each value. Host labels must be exact enumerable data
 * fields and bounded non-empty visible strings. The required thread-label
 * factory may be accompanied by paired status/comment-summary factories;
 * supplying only one summary factory fails closed. Accessor-backed labels and
 * thrown/private label failures are normalized to the same redacted
 * presentation error before React commits inaccessible content. When summary
 * factories are present their localized visible output also describes the
 * thread-selection, reply, and resolve controls without changing action names.
 * Required and optional host intent callbacks are preflighted and snapshotted
 * before rendering so malformed runtime values fail closed at the same public
 * presentation boundary rather than surfacing a native invocation TypeError.
 * Arrow Up/Down and Home/End move DOM focus only among thread-selection targets;
 * keyboard traversal never commits host-controlled thread selection. Repeated
 * reply/resolve controls include the already validated thread label in their
 * accessible name so action lists remain disambiguated without changing visible
 * host copy. The component emits only intent callbacks with the detached, frozen
 * presentation snapshot; it does not authorize, persist, transport, mutate,
 * resolve, or reply to host-owned review records.
 */
export function CwlReviewThreadList({
  presentations,
  labels,
  onSelectThread,
  onReplyThread,
  onResolveThread,
}: CwlReviewThreadListProps) {
  const listId = useId();
  const threadButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const validatedPresentations =
    validateReviewThreadPresentations(presentations);
  const validatedLabels = validateReviewThreadListLabels(labels);
  const validatedCallbacks = validateReviewIntentCallbacks(
    onSelectThread,
    onReplyThread,
    onResolveThread,
  );

  return (
    <section aria-label={validatedLabels.region}>
      <ul>
        {validatedPresentations.map((presentation, index) => {
          const threadLabel = createThreadLabel(
            validatedLabels.thread,
            presentation,
            index,
          );
          const statusFactory = validatedLabels.status;
          const commentsFactory = validatedLabels.comments;
          const semanticSummary =
            statusFactory !== undefined && commentsFactory !== undefined
              ? {
                  status: createThreadSummaryLabel(
                    statusFactory,
                    presentation,
                    index,
                  ),
                  comments: createThreadSummaryLabel(
                    commentsFactory,
                    presentation,
                    index,
                  ),
                }
              : undefined;
          const summaryId =
            semanticSummary === undefined
              ? undefined
              : `${listId}-thread-${index}-summary`;
          const replyHandler =
            presentation.canReply &&
            validatedCallbacks.onReplyThread !== undefined
              ? () => validatedCallbacks.onReplyThread!(presentation)
              : undefined;
          const resolveHandler =
            presentation.state === 'unresolved' &&
            presentation.canResolve &&
            validatedCallbacks.onResolveThread !== undefined
              ? () => validatedCallbacks.onResolveThread!(presentation)
              : undefined;

          return (
            <li key={presentation.threadKey}>
              <button
                ref={(button) => {
                  threadButtons.current[index] = button;
                }}
                type="button"
                aria-pressed={presentation.selected}
                aria-describedby={summaryId}
                onClick={() => validatedCallbacks.onSelectThread(presentation)}
                onKeyDown={(event) => {
                  const targetIndex = reviewThreadFocusIndex(
                    event.key,
                    index,
                    validatedPresentations.length - 1,
                  );
                  if (targetIndex === undefined) {
                    return;
                  }
                  event.preventDefault();
                  threadButtons.current[targetIndex]!.focus();
                }}
              >
                {threadLabel}
              </button>
              {semanticSummary === undefined ? null : (
                <span id={summaryId}>
                  <span>{semanticSummary.status}</span>{' '}
                  <span>{semanticSummary.comments}</span>
                </span>
              )}
              <button
                type="button"
                aria-label={`${validatedLabels.reply} — ${threadLabel}`}
                aria-describedby={summaryId}
                disabled={replyHandler === undefined}
                onClick={replyHandler}
              >
                {validatedLabels.reply}
              </button>
              <button
                type="button"
                aria-label={`${validatedLabels.resolve} — ${threadLabel}`}
                aria-describedby={summaryId}
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
