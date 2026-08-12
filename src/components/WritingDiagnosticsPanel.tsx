import { useRef, useState } from 'react';
import type { WritingDiagnosticsController } from './useWritingDiagnosticsController.js';

/** Props for Inkspan's provider-neutral writing-guidance presentation surface. */
export interface WritingDiagnosticsPanelProps {
  /** Revision-bound diagnostics and local advisory actions owned by the controller. */
  readonly controller: WritingDiagnosticsController;
  /** Accessible name for the guidance region. */
  readonly label: string;
  /** Host-owned replacement request. Task 6 performs revision-rechecked mutation. */
  readonly onApplyDiagnostic?: (diagnosticId: string) => void;
  /** Host-supplied, already-redacted conflict text announced assertively. */
  readonly conflictMessage?: string;
}

/**
 * Render already-validated writing diagnostics as accessible plain text.
 *
 * Inkspan does not infer language quality, reinterpret host categories, or call
 * models, providers, networks, persistence services, or host transports here.
 */
export function WritingDiagnosticsPanel({
  controller,
  label,
  onApplyDiagnostic,
  conflictMessage,
}: WritingDiagnosticsPanelProps) {
  const diagnostics = controller.diagnostics;
  const [activeDiagnosticId, setActiveDiagnosticId] = useState<string | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState('');
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const selectedIndex = diagnostics.findIndex(
    (candidate) =>
      candidate.diagnostic.diagnosticId === activeDiagnosticId,
  );
  const activeIndex = selectedIndex < 0 ? 0 : selectedIndex;

  const navigate = (offset: number): void => {
    if (diagnostics.length === 0) return;
    const targetIndex =
      (activeIndex + offset + diagnostics.length) % diagnostics.length;
    const target = diagnostics[targetIndex]!;
    const diagnosticId = target.diagnostic.diagnosticId;
    setActiveDiagnosticId(diagnosticId);
    controller.focusDiagnostic(diagnosticId);
    itemRefs.current[targetIndex]?.focus();
  };

  return (
    <section
      aria-label={label}
      className="cwl-writing-diagnostics"
      role="region"
    >
      <div className="cwl-writing-diagnostics__header">
        <p className="cwl-writing-diagnostics__summary">
          {diagnostics.length} writing diagnostics
        </p>
        <div
          aria-label="Writing diagnostic navigation"
          className="cwl-writing-diagnostics__navigation"
          role="group"
        >
          <button
            aria-label="Previous writing diagnostic"
            className="cwl-writing-diagnostics__navigation-button"
            disabled={diagnostics.length < 2}
            onClick={() => navigate(-1)}
            type="button"
          >
            Previous
          </button>
          <button
            aria-label="Next writing diagnostic"
            className="cwl-writing-diagnostics__navigation-button"
            disabled={diagnostics.length < 2}
            onClick={() => navigate(1)}
            type="button"
          >
            Next
          </button>
        </div>
      </div>

      <ol className="cwl-writing-diagnostics__list">
        {diagnostics.map((verified, index) => {
          const diagnostic = verified.diagnostic;
          const hasReplacement =
            diagnostic.suggestedReplacement !== undefined;
          return (
            <li
              className={`cwl-writing-diagnostics__item cwl-writing-diagnostics__item--${diagnostic.priority}`}
              key={diagnostic.diagnosticId}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              tabIndex={index === activeIndex ? 0 : -1}
            >
              <article>
                <header className="cwl-writing-diagnostics__item-header">
                  <h3>{diagnostic.title}</h3>
                  <span>{diagnostic.priority}</span>
                  <span>{diagnostic.categoryCode}</span>
                </header>
                <p>{diagnostic.explanation}</p>
                {hasReplacement ? (
                  <p className="cwl-writing-diagnostics__replacement">
                    {diagnostic.suggestedReplacement}
                  </p>
                ) : null}
                <div className="cwl-writing-diagnostics__actions">
                  <button
                    aria-label={`Focus affected text for ${diagnostic.title}`}
                    onClick={() => {
                      setActiveDiagnosticId(diagnostic.diagnosticId);
                      controller.focusDiagnostic(diagnostic.diagnosticId);
                    }}
                    type="button"
                  >
                    Focus text
                  </button>
                  <button
                    aria-label={`Apply suggestion for ${diagnostic.title}`}
                    disabled={!hasReplacement || onApplyDiagnostic === undefined}
                    onClick={() =>
                      onApplyDiagnostic?.(diagnostic.diagnosticId)
                    }
                    type="button"
                  >
                    Apply
                  </button>
                  <button
                    aria-label={`Ignore ${diagnostic.title}`}
                    onClick={() => {
                      if (
                        controller.ignoreDiagnostic(
                          diagnostic.diagnosticId,
                        ) !== null
                      ) {
                        setStatusMessage(`Ignored ${diagnostic.title}.`);
                      }
                    }}
                    type="button"
                  >
                    Ignore
                  </button>
                  <button
                    aria-label={`Dismiss ${diagnostic.title}`}
                    onClick={() => {
                      if (
                        controller.dismissDiagnostic(
                          diagnostic.diagnosticId,
                        ) !== null
                      ) {
                        setStatusMessage(`Dismissed ${diagnostic.title}.`);
                      }
                    }}
                    type="button"
                  >
                    Dismiss
                  </button>
                  <button
                    aria-label={`Explain ${diagnostic.title}`}
                    onClick={() => {
                      if (
                        controller.requestDiagnosticExplanation(
                          diagnostic.diagnosticId,
                        ) !== null
                      ) {
                        setStatusMessage(
                          `Requested explanation for ${diagnostic.title}.`,
                        );
                      }
                    }}
                    type="button"
                  >
                    Explain
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ol>

      <p aria-live="polite" className="cwl-writing-diagnostics__status" role="status">
        {statusMessage}
      </p>
      {conflictMessage === undefined ? null : (
        <p className="cwl-writing-diagnostics__conflict" role="alert">
          {conflictMessage}
        </p>
      )}
    </section>
  );
}

export default WritingDiagnosticsPanel;
