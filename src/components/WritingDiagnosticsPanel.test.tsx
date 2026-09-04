import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CwlWritingDiagnosticActionEvent,
  CwlVerifiedWritingDiagnostic,
  WritingDiagnosticsController,
} from './useWritingDiagnosticsController.js';
import { WritingDiagnosticsPanel } from './WritingDiagnosticsPanel.js';

const digestHex = '4a'.repeat(32);
const documentRevision = Object.freeze({
  algorithm: 'SHA-256' as const,
  digestHex,
  strongEntityTag: `"sha256-${digestHex}"`,
});
const textProjection = Object.freeze({
  id: 'inkspan-prosemirror-text' as const,
  version: 1 as const,
});

function verifiedDiagnostic(
  diagnosticId: string,
  title: string,
  options: Readonly<{
    categoryCode?: string;
    priority?: 'advisory' | 'important' | 'critical';
    explanation?: string;
    suggestedReplacement?: string;
    from?: number;
    to?: number;
  }> = {},
): CwlVerifiedWritingDiagnostic {
  const diagnostic = {
    diagnosticId,
    documentRevision,
    textProjection,
    selector: Object.freeze({
      type: 'TextPositionSelector' as const,
      start: 0,
      end: 4,
    }),
    categoryCode: options.categoryCode ?? 'clarity',
    priority: options.priority ?? 'advisory',
    title,
    explanation: options.explanation ?? 'Clarify the intended decision.',
    provenance: Object.freeze({
      workflowId: 'writing-review',
      workflowVersion: '1',
      judgePolicyVersion: '1',
    }),
    ...(options.suggestedReplacement === undefined
      ? {}
      : { suggestedReplacement: options.suggestedReplacement }),
  };
  return Object.freeze({
    diagnostic: Object.freeze(diagnostic),
    from: options.from ?? 1,
    to: options.to ?? 5,
  });
}

function actionEvent(
  diagnostic: CwlVerifiedWritingDiagnostic,
  action: CwlWritingDiagnosticActionEvent['action'],
): CwlWritingDiagnosticActionEvent {
  return Object.freeze({
    action,
    reasonCode: 'explicit',
    diagnosticId: diagnostic.diagnostic.diagnosticId,
    documentRevision,
    categoryCode: diagnostic.diagnostic.categoryCode,
    generation: 7,
  });
}

function controllerFor(
  diagnostics: readonly CwlVerifiedWritingDiagnostic[],
): WritingDiagnosticsController {
  return {
    status: diagnostics.length === 0 ? 'absent' : 'active',
    generation: 7,
    editor: null,
    diagnostics,
    digestProvider: null,
    focusDiagnostic: vi.fn(() => true),
    ignoreDiagnostic: vi.fn((diagnosticId) => {
      const diagnostic = diagnostics.find(
        (candidate) => candidate.diagnostic.diagnosticId === diagnosticId,
      );
      return diagnostic === undefined
        ? null
        : actionEvent(diagnostic, 'ignored');
    }),
    dismissDiagnostic: vi.fn((diagnosticId) => {
      const diagnostic = diagnostics.find(
        (candidate) => candidate.diagnostic.diagnosticId === diagnosticId,
      );
      return diagnostic === undefined
        ? null
        : actionEvent(diagnostic, 'dismissed');
    }),
    requestDiagnosticExplanation: vi.fn((diagnosticId) => {
      const diagnostic = diagnostics.find(
        (candidate) => candidate.diagnostic.diagnosticId === diagnosticId,
      );
      return diagnostic === undefined
        ? null
        : actionEvent(diagnostic, 'requested_explanation');
    }),
  };
}

afterEach(cleanup);

describe('WritingDiagnosticsPanel', () => {
  it('renders bounded host guidance as accessible text with explicit actions', () => {
    const first = verifiedDiagnostic(
      'diagnostic-one',
      'Clarify <img src=x onerror=alert(1)>',
      {
        categoryCode: 'clarity',
        priority: 'important',
        suggestedReplacement: 'State the approved decision.',
      },
    );
    const second = verifiedDiagnostic('diagnostic-two', 'Add supporting evidence', {
      categoryCode: 'evidence',
      priority: 'critical',
      explanation: 'Cite the source used for this claim.',
      from: 8,
      to: 12,
    });
    const controller = controllerFor([first, second]);
    const applyDiagnostic = vi.fn();

    render(
      <WritingDiagnosticsPanel
        controller={controller}
        label="Writing guidance"
        onApplyDiagnostic={applyDiagnostic}
      />,
    );

    const region = screen.getByRole('region', { name: 'Writing guidance' });
    expect(within(region).getByText('2 writing diagnostics')).toBeVisible();
    expect(within(region).getByRole('list')).toBeVisible();
    expect(within(region).getAllByRole('listitem')).toHaveLength(2);
    expect(
      within(region).getByText('Clarify <img src=x onerror=alert(1)>'),
    ).toBeVisible();
    expect(region.querySelector('img')).toBeNull();
    expect(within(region).getByText('important')).toBeVisible();
    expect(within(region).getByText('clarity')).toBeVisible();
    expect(within(region).getByText('Cite the source used for this claim.')).toBeVisible();

    const focusFirst = within(region).getByRole('button', {
      name: 'Focus affected text for Clarify <img src=x onerror=alert(1)>',
    });
    fireEvent.click(focusFirst);
    expect(controller.focusDiagnostic).toHaveBeenCalledWith('diagnostic-one');

    const firstApply = within(region).getByRole('button', {
      name: 'Apply suggestion for Clarify <img src=x onerror=alert(1)>',
    });
    expect(firstApply).toBeEnabled();
    fireEvent.click(firstApply);
    expect(applyDiagnostic).toHaveBeenCalledWith('diagnostic-one');

    expect(
      within(region).getByRole('button', {
        name: 'Apply suggestion for Add supporting evidence',
      }),
    ).toBeDisabled();

    fireEvent.click(
      within(region).getByRole('button', {
        name: 'Ignore Add supporting evidence',
      }),
    );
    expect(controller.ignoreDiagnostic).toHaveBeenCalledWith('diagnostic-two');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Ignored Add supporting evidence.',
    );

    fireEvent.click(
      within(region).getByRole('button', {
        name: 'Dismiss Add supporting evidence',
      }),
    );
    expect(controller.dismissDiagnostic).toHaveBeenCalledWith('diagnostic-two');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Dismissed Add supporting evidence.',
    );

    fireEvent.click(
      within(region).getByRole('button', {
        name: 'Explain Add supporting evidence',
      }),
    );
    expect(controller.requestDiagnosticExplanation).toHaveBeenCalledWith(
      'diagnostic-two',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Requested explanation for Add supporting evidence.',
    );
  });

  it('does not steal focus when diagnostics arrive and provides explicit roving navigation', () => {
    const first = verifiedDiagnostic('diagnostic-one', 'First diagnostic', {
      suggestedReplacement: 'First replacement',
    });
    const second = verifiedDiagnostic('diagnostic-two', 'Second diagnostic');
    const emptyController = controllerFor([]);
    const activeController = controllerFor([first, second]);
    const { rerender } = render(
      <>
        <button type="button">Host focus</button>
        <WritingDiagnosticsPanel
          controller={emptyController}
          label="Writing guidance"
        />
      </>,
    );
    const hostFocus = screen.getByRole('button', { name: 'Host focus' });
    hostFocus.focus();

    rerender(
      <>
        <button type="button">Host focus</button>
        <WritingDiagnosticsPanel
          controller={activeController}
          label="Writing guidance"
        />
      </>,
    );

    expect(hostFocus).toHaveFocus();
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('tabindex', '0');
    expect(items[1]).toHaveAttribute('tabindex', '-1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Next writing diagnostic' }),
    );
    expect(activeController.focusDiagnostic).toHaveBeenCalledWith(
      'diagnostic-two',
    );
    expect(items[1]).toHaveFocus();
    expect(items[0]).toHaveAttribute('tabindex', '-1');
    expect(items[1]).toHaveAttribute('tabindex', '0');

    fireEvent.click(
      screen.getByRole('button', { name: 'Previous writing diagnostic' }),
    );
    expect(activeController.focusDiagnostic).toHaveBeenCalledWith(
      'diagnostic-one',
    );
    expect(items[0]).toHaveFocus();
  });

  it('uses an assertive alert only for an application conflict', () => {
    const diagnostic = verifiedDiagnostic('diagnostic-one', 'Conflicting change', {
      suggestedReplacement: 'Replacement',
    });
    const controller = controllerFor([diagnostic]);

    render(
      <WritingDiagnosticsPanel
        controller={controller}
        label="Writing guidance"
        conflictMessage="The document changed before this suggestion could be applied."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The document changed before this suggestion could be applied.',
    );
    expect(screen.queryByRole('status')).not.toHaveTextContent(
      'The document changed before this suggestion could be applied.',
    );
  });
});
