import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import type {
  CwlVerifiedWritingDiagnostic,
  WritingDiagnosticsControllerStatus,
} from './useWritingDiagnosticsController.js';

/** Result understood by the presentational panel before Task 6 owns mutation. */
export type WritingDiagnosticPanelApplyResult =
  | 'completed'
  | 'conflict'
  | 'stale'
  | null
  | void;

/** Internal, host-neutral props for the accessible writing-diagnostics panel. */
export interface WritingDiagnosticsPanelProps {
  readonly status: WritingDiagnosticsControllerStatus;
  readonly diagnostics: readonly CwlVerifiedWritingDiagnostic[];
  readonly onFocusDiagnostic?: (diagnosticId: string) => boolean;
  readonly onApplyDiagnostic?: (
    diagnosticId: string,
  ) =>
    | WritingDiagnosticPanelApplyResult
    | Promise<WritingDiagnosticPanelApplyResult>;
  readonly onIgnoreDiagnostic?: (diagnosticId: string) => unknown;
  readonly onDismissDiagnostic?: (diagnosticId: string) => unknown;
  readonly onRequestDiagnosticExplanation?: (diagnosticId: string) => unknown;
  /** Print diagnostics only when the host deliberately opts in. */
  readonly printWritingDiagnostics?: boolean;
}

function suggestionCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'suggestion' : 'suggestions'}`;
}

/**
 * Render already-verified host diagnostics as advisory, keyboard-reachable UI.
 *
 * All host strings are rendered as React text nodes. This component performs
 * no semantic judgment, model/network work, persistence, or document mutation.
 */
export function WritingDiagnosticsPanel({
  status,
  diagnostics,
  onFocusDiagnostic,
  onApplyDiagnostic,
  onIgnoreDiagnostic,
  onDismissDiagnostic,
  onRequestDiagnosticExplanation,
  printWritingDiagnostics = false,
}: WritingDiagnosticsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => diagnostics[0]?.diagnostic.diagnosticId ?? null,
  );
  const [liveMessage, setLiveMessage] = useState('');
  const [conflictMessage, setConflictMessage] = useState('');
  const cardRefs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    setSelectedId((current) => {
      if (
        current !== null &&
        diagnostics.some(
          (item) => item.diagnostic.diagnosticId === current,
        )
      ) {
        return current;
      }
      return diagnostics[0]?.diagnostic.diagnosticId ?? null;
    });
  }, [diagnostics]);

  const active = status === 'active';

  const focusByOffset = (offset: -1 | 1): void => {
    if (!active || diagnostics.length === 0) return;
    const currentIndex = diagnostics.findIndex(
      (item) => item.diagnostic.diagnosticId === selectedId,
    );
    const safeIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex =
      (safeIndex + offset + diagnostics.length) % diagnostics.length;
    const nextId = diagnostics[nextIndex]!.diagnostic.diagnosticId;
    setSelectedId(nextId);
    cardRefs.current.get(nextId)?.focus();
  };

  const runAdvisoryAction = (
    item: CwlVerifiedWritingDiagnostic,
    action: 'ignored' | 'dismissed' | 'explanation',
  ): void => {
    const { diagnostic } = item;
    try {
      if (action === 'ignored') {
        onIgnoreDiagnostic?.(diagnostic.diagnosticId);
        setLiveMessage(`Ignored ${diagnostic.title}`);
      } else if (action === 'dismissed') {
        onDismissDiagnostic?.(diagnostic.diagnosticId);
        setLiveMessage(`Dismissed ${diagnostic.title}`);
      } else {
        onRequestDiagnosticExplanation?.(diagnostic.diagnosticId);
        setLiveMessage(`Explanation requested for ${diagnostic.title}`);
      }
    } catch {
      setLiveMessage(`Action could not be completed for ${diagnostic.title}`);
    }
  };

  const applyDiagnostic = async (
    item: CwlVerifiedWritingDiagnostic,
  ): Promise<void> => {
    const { diagnostic } = item;
    setConflictMessage('');
    try {
      const result = await onApplyDiagnostic?.(diagnostic.diagnosticId);
      if (result === 'conflict') {
        setConflictMessage(
          'Suggestion could not be applied because the document changed.',
        );
        return;
      }
      if (result === 'stale') {
        setLiveMessage(`Suggestion is stale: ${diagnostic.title}`);
        return;
      }
      setLiveMessage(`Applied ${diagnostic.title}`);
    } catch {
      setLiveMessage(`Apply could not be completed for ${diagnostic.title}`);
    }
  };

  const setCardRef =
    (diagnosticId: string) => (node: HTMLLIElement | null): void => {
      if (node === null) cardRefs.current.delete(diagnosticId);
      else cardRefs.current.set(diagnosticId, node);
    };

  const preventDefault = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
  };

  return (
    <section
      className={`cwl-writing-diagnostics-panel${
        printWritingDiagnostics
          ? ' cwl-writing-diagnostics-panel--print'
          : ' cwl-writing-diagnostics-panel--screen-only'
      }`}
      aria-label="Writing suggestions"
    >
      <div className="cwl-writing-diagnostics-panel__header">
        <strong>Writing suggestions</strong>
        <span>{suggestionCountLabel(diagnostics.length)}</span>
      </div>
      <div
        className="cwl-writing-diagnostics-panel__navigation"
        role="group"
        aria-label="Suggestion navigation"
      >
        <button
          type="button"
          className="cwl-writing-diagnostics-panel__button"
          aria-label="Previous suggestion"
          disabled={!active || diagnostics.length === 0}
          onMouseDown={preventDefault}
          onClick={() => focusByOffset(-1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="cwl-writing-diagnostics-panel__button"
          aria-label="Next suggestion"
          disabled={!active || diagnostics.length === 0}
          onMouseDown={preventDefault}
          onClick={() => focusByOffset(1)}
        >
          Next
        </button>
      </div>
      <ol className="cwl-writing-diagnostics-panel__list">
        {diagnostics.map((item) => {
          const { diagnostic } = item;
          const isSelected = diagnostic.diagnosticId === selectedId;
          return (
            <li
              key={diagnostic.diagnosticId}
              ref={setCardRef(diagnostic.diagnosticId)}
              data-testid={`writing-diagnostic-${diagnostic.diagnosticId}`}
              data-priority={diagnostic.priority}
              data-selected={isSelected ? 'true' : 'false'}
              className={`cwl-writing-diagnostics-panel__item cwl-writing-diagnostics-panel__item--${diagnostic.priority}`}
              tabIndex={isSelected ? 0 : -1}
              onFocus={() => {
                setSelectedId(diagnostic.diagnosticId);
                onFocusDiagnostic?.(diagnostic.diagnosticId);
              }}
            >
              <div className="cwl-writing-diagnostics-panel__meta">
                <span>{diagnostic.categoryCode}</span>
                <span>{diagnostic.priority}</span>
                <span>
                  Characters {diagnostic.selector.start + 1}–{diagnostic.selector.end}
                </span>
              </div>
              <strong className="cwl-writing-diagnostics-panel__title">
                {diagnostic.title}
              </strong>
              <p className="cwl-writing-diagnostics-panel__explanation">
                {diagnostic.explanation}
              </p>
              {diagnostic.suggestedReplacement === undefined ? null : (
                <p className="cwl-writing-diagnostics-panel__replacement">
                  <span className="cwl-writing-diagnostics-panel__replacement-label">
                    Suggested replacement
                  </span>{' '}
                  {diagnostic.suggestedReplacement}
                </p>
              )}
              <div className="cwl-writing-diagnostics-panel__actions">
                <button
                  type="button"
                  className="cwl-writing-diagnostics-panel__button"
                  aria-label={`Apply ${diagnostic.title}`}
                  disabled={
                    !active || diagnostic.suggestedReplacement === undefined
                  }
                  onMouseDown={preventDefault}
                  onClick={() => void applyDiagnostic(item)}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="cwl-writing-diagnostics-panel__button"
                  aria-label={`Ignore ${diagnostic.title}`}
                  disabled={!active}
                  onMouseDown={preventDefault}
                  onClick={() => runAdvisoryAction(item, 'ignored')}
                >
                  Ignore
                </button>
                <button
                  type="button"
                  className="cwl-writing-diagnostics-panel__button"
                  aria-label={`Dismiss ${diagnostic.title}`}
                  disabled={!active}
                  onMouseDown={preventDefault}
                  onClick={() => runAdvisoryAction(item, 'dismissed')}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="cwl-writing-diagnostics-panel__button"
                  aria-label={`Explain ${diagnostic.title}`}
                  disabled={!active}
                  onMouseDown={preventDefault}
                  onClick={() => runAdvisoryAction(item, 'explanation')}
                >
                  Explain
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <p
        className="cwl-writing-diagnostics-panel__status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveMessage}
      </p>
      {conflictMessage === '' ? null : (
        <p
          className="cwl-writing-diagnostics-panel__alert"
          role="alert"
          aria-live="assertive"
        >
          {conflictMessage}
        </p>
      )}
    </section>
  );
}

export default WritingDiagnosticsPanel;
