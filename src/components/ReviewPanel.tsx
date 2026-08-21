import { useState } from 'react';
import type {
  CwlEditorReviewProps,
} from '../types.js';
import type {
  CwlEditorReviewSuggestion,
  CwlEditorReviewTarget,
} from '../review/contract.js';

interface ReviewPanelProps {
  readonly review: CwlEditorReviewProps;
  /** Whether document-mutating review actions are currently permitted by the editor surface. */
  readonly editable?: boolean;
  readonly onAction: (
    suggestion: CwlEditorReviewSuggestion,
    action: 'accept' | 'reject',
  ) => Promise<void>;
  readonly onSelect: (target: CwlEditorReviewTarget) => void;
}

/** Render accessible host-controlled threads and deterministic suggestions. */
export function ReviewPanel({
  review,
  editable = true,
  onAction,
  onSelect,
}: ReviewPanelProps) {
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const suggestions = review.suggestions ?? [];
  const threads = review.threads ?? [];
  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <section className="cwl-review-panel" aria-label="Document review">
      <h2 className="cwl-review-panel__heading">Review</h2>
      {threads.length > 0 ? (
        <div className="cwl-review-panel__section">
          <h3>Comments</h3>
          <ul>
            {threads.map((thread) => (
              <li key={thread.threadId}>
                <button
                  type="button"
                  className="cwl-review-panel__target"
                  onClick={() => onSelect(thread.target)}
                >
                  {thread.threadId} · {thread.state} · {thread.replyCount} replies
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="cwl-review-panel__section">
        <h3>Suggestions</h3>
        {suggestions.length === 0 ? <p>No suggestions.</p> : null}
        <ul>
          {suggestions.map((suggestion) => {
            const busy = busyIds.has(suggestion.suggestionId);
            const final = suggestion.state !== 'pending';
            const actionDisabled = !editable || busy || final;
            return (
              <li key={suggestion.suggestionId}>
                <button
                  type="button"
                  className="cwl-review-panel__target"
                  onClick={() => onSelect(suggestion.target)}
                >
                  {suggestion.suggestionId} · {suggestion.kind} · {suggestion.state}
                </button>
                {suggestion.kind === 'insert' ? (
                  <span className="cwl-review-panel__detail"> “{suggestion.text}”</span>
                ) : null}
                <div className="cwl-review-panel__actions">
                  <button
                    type="button"
                    onClick={async () => {
                      setBusy(suggestion.suggestionId, true);
                      try {
                        await onAction(suggestion, 'accept');
                      } finally {
                        setBusy(suggestion.suggestionId, false);
                      }
                    }}
                    disabled={actionDisabled}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setBusy(suggestion.suggestionId, true);
                      try {
                        await onAction(suggestion, 'reject');
                      } finally {
                        setBusy(suggestion.suggestionId, false);
                      }
                    }}
                    disabled={actionDisabled}
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
