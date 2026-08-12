import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CwlVerifiedWritingDiagnostic } from './useWritingDiagnosticsController.js';
import { WritingDiagnosticsPanel } from './WritingDiagnosticsPanel.js';

const DIGEST = '11'.repeat(32);

function verified(
  id: string,
  title: string,
  replacement?: string,
): CwlVerifiedWritingDiagnostic {
  return {
    from: id === 'first' ? 1 : 7,
    to: id === 'first' ? 6 : 11,
    diagnostic: {
      diagnosticId: id,
      documentRevision: {
        algorithm: 'SHA-256',
        digestHex: DIGEST,
        strongEntityTag: `"sha256-${DIGEST}"`,
      },
      textProjection: {
        id: 'cwl-prosemirror-text-v1',
        version: 1,
      },
      selector: {
        type: 'TextPositionSelector',
        start: id === 'first' ? 0 : 6,
        end: id === 'first' ? 5 : 10,
      },
      categoryCode: id === 'first' ? 'clarity' : 'tone',
      priority: id === 'first' ? 'important' : 'advisory',
      title,
      explanation: `${title} explanation`,
      ...(replacement === undefined
        ? {}
        : { suggestedReplacement: replacement }),
      provenance: {
        workflowId: 'review',
        workflowVersion: '1',
        judgePolicyVersion: '1',
      },
    },
  };
}

const diagnostics = [
  verified('first', 'Replace wording', 'Better wording'),
  verified('second', 'Check tone'),
];

describe('WritingDiagnosticsPanel', () => {
  it('renders a named ordered suggestion region with non-color-only diagnostic details', () => {
    render(
      <WritingDiagnosticsPanel
        status="active"
        diagnostics={diagnostics}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Writing suggestions' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 suggestions')).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Replace wording')).toBeInTheDocument();
    expect(screen.getByText('clarity')).toBeInTheDocument();
    expect(screen.getByText('important')).toBeInTheDocument();
    expect(screen.getByText('Replace wording explanation')).toBeInTheDocument();
    expect(screen.getByText('Better wording')).toBeInTheDocument();
    expect(screen.getByText('Check tone')).toBeInTheDocument();
  });

  it('uses explicit title-bearing action names and disables Apply without a replacement', () => {
    render(
      <WritingDiagnosticsPanel
        status="active"
        diagnostics={diagnostics}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Apply Replace wording' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Apply Check tone' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Ignore Replace wording' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Dismiss Replace wording' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Explain Replace wording' }),
    ).toBeEnabled();
  });

  it('navigates explicitly without stealing focus when diagnostics arrive asynchronously', async () => {
    const user = userEvent.setup();
    const onFocusDiagnostic = vi.fn(() => true);
    const { rerender } = render(
      <WritingDiagnosticsPanel
        status="active"
        diagnostics={[diagnostics[0]!]}
        onFocusDiagnostic={onFocusDiagnostic}
      />,
    );

    const next = screen.getByRole('button', { name: 'Next suggestion' });
    next.focus();
    rerender(
      <WritingDiagnosticsPanel
        status="active"
        diagnostics={diagnostics}
        onFocusDiagnostic={onFocusDiagnostic}
      />,
    );
    expect(document.activeElement).toBe(next);
    expect(onFocusDiagnostic).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Next suggestion' }));
    expect(onFocusDiagnostic).toHaveBeenLastCalledWith('second');
    expect(screen.getByTestId('writing-diagnostic-second')).toHaveFocus();
  });

  it('routes advisory actions without source text and announces completion politely', async () => {
    const user = userEvent.setup();
    const onIgnoreDiagnostic = vi.fn();
    const onDismissDiagnostic = vi.fn();
    const onRequestDiagnosticExplanation = vi.fn();
    render(
      <WritingDiagnosticsPanel
        status="active"
        diagnostics={diagnostics}
        onIgnoreDiagnostic={onIgnoreDiagnostic}
        onDismissDiagnostic={onDismissDiagnostic}
        onRequestDiagnosticExplanation={onRequestDiagnosticExplanation}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Ignore Replace wording' }),
    );
    expect(onIgnoreDiagnostic).toHaveBeenCalledWith('first');
    expect(screen.getByRole('status')).toHaveTextContent('Ignored Replace wording');

    await user.click(
      screen.getByRole('button', { name: 'Explain Replace wording' }),
    );
    expect(onRequestDiagnosticExplanation).toHaveBeenCalledWith('first');

    await user.click(
      screen.getByRole('button', { name: 'Dismiss Replace wording' }),
    );
    expect(onDismissDiagnostic).toHaveBeenCalledWith('first');
  });

  it('announces an application conflict assertively and never emits host text as markup', async () => {
    const user = userEvent.setup();
    const onApplyDiagnostic = vi.fn(() => 'conflict' as const);
    const hostile = verified('first', '<img src=x onerror=alert(1)>', '<b>safe text</b>');
    const { container } = render(
      <WritingDiagnosticsPanel
        status="active"
        diagnostics={[hostile]}
        onApplyDiagnostic={onApplyDiagnostic}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Apply <img src=x onerror=alert(1)>',
      }),
    );
    expect(onApplyDiagnostic).toHaveBeenCalledWith('first');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Suggestion could not be applied because the document changed.',
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('supports roving card focus with previous and next navigation', () => {
    const onFocusDiagnostic = vi.fn(() => true);
    render(
      <WritingDiagnosticsPanel
        status="active"
        diagnostics={diagnostics}
        onFocusDiagnostic={onFocusDiagnostic}
      />,
    );

    const first = screen.getByTestId('writing-diagnostic-first');
    const second = screen.getByTestId('writing-diagnostic-second');
    expect(first).toHaveAttribute('tabindex', '0');
    expect(second).toHaveAttribute('tabindex', '-1');

    fireEvent.click(screen.getByRole('button', { name: 'Next suggestion' }));
    expect(first).toHaveAttribute('tabindex', '-1');
    expect(second).toHaveAttribute('tabindex', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Previous suggestion' }));
    expect(first).toHaveAttribute('tabindex', '0');
    expect(second).toHaveAttribute('tabindex', '-1');
  });
});
