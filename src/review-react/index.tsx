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

/**
 * Render a controlled accessible list of bounded review-thread presentations.
 *
 * Every source record passes through the React-free review validator before any
 * host metadata is rendered. The component emits only intent callbacks with the
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

  return (
    <section aria-label={labels.region}>
      <ul>
        {validatedPresentations.map((presentation, index) => {
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
                {labels.thread(presentation, index)}
              </button>
              <button
                type="button"
                disabled={replyHandler === undefined}
                onClick={replyHandler}
              >
                {labels.reply}
              </button>
              <button
                type="button"
                disabled={resolveHandler === undefined}
                onClick={resolveHandler}
              >
                {labels.resolve}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
