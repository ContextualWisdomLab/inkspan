import { useState } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type {
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
): CwlVerifiedWritingDiagnostic {
  return Object.freeze({
    diagnostic: Object.freeze({
      diagnosticId,
      documentRevision,
      textProjection,
      selector: Object.freeze({
        type: 'TextPositionSelector' as const,
        start: 0,
        end: 4,
      }),
      categoryCode: 'clarity',
      priority: 'advisory' as const,
      title,
      explanation: 'Clarify the intended decision.',
      provenance: Object.freeze({
        workflowId: 'writing-review',
        workflowVersion: '1',
        judgePolicyVersion: '1',
      }),
    }),
    from: 1,
    to: 5,
  });
}

function StatefulDiagnosticsPanel({
  initialDiagnostics,
  focusDiagnostic,
}: Readonly<{
  initialDiagnostics: readonly CwlVerifiedWritingDiagnostic[];
  focusDiagnostic: WritingDiagnosticsController['focusDiagnostic'];
}>) {
  const [diagnostics, setDiagnostics] = useState(initialDiagnostics);
  const controller: WritingDiagnosticsController = {
    status: diagnostics.length === 0 ? 'absent' : 'active',
    generation: 7,
    editor: null,
    diagnostics,
    digestProvider: null,
    focusDiagnostic,
    applyDiagnostic: async () => null,
    ignoreDiagnostic: () => null,
    dismissDiagnostic: (diagnosticId) => {
      const diagnostic = diagnostics.find(
        (candidate) => candidate.diagnostic.diagnosticId === diagnosticId,
      );
      if (diagnostic === undefined) return null;
      setDiagnostics((current) =>
        current.filter(
          (candidate) => candidate.diagnostic.diagnosticId !== diagnosticId,
        ),
      );
      return Object.freeze({
        action: 'dismissed' as const,
        reasonCode: 'explicit' as const,
        diagnosticId,
        documentRevision,
        categoryCode: diagnostic.diagnostic.categoryCode,
        generation: 7,
      });
    },
    requestDiagnosticExplanation: () => null,
  };

  return (
    <WritingDiagnosticsPanel
      controller={controller}
      label="Writing guidance"
    />
  );
}

afterEach(cleanup);

it('moves focus to the next surviving diagnostic after a stateful dismissal', () => {
  const first = verifiedDiagnostic('diagnostic-one', 'First diagnostic');
  const second = verifiedDiagnostic('diagnostic-two', 'Second diagnostic');
  const focusDiagnostic = vi.fn(() => true);

  render(
    <StatefulDiagnosticsPanel
      focusDiagnostic={focusDiagnostic}
      initialDiagnostics={[first, second]}
    />,
  );

  const dismissFirst = screen.getByRole('button', {
    name: 'Dismiss First diagnostic',
  });
  dismissFirst.focus();
  expect(dismissFirst).toHaveFocus();

  fireEvent.click(dismissFirst);

  const remainingItems = screen.getAllByRole('listitem');
  expect(remainingItems).toHaveLength(1);
  expect(remainingItems[0]).toHaveFocus();
  expect(remainingItems[0]).toHaveAttribute('tabindex', '0');
  expect(focusDiagnostic).toHaveBeenLastCalledWith('diagnostic-two');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Dismissed First diagnostic.',
  );
});

it('moves focus to the guidance region when the final diagnostic is dismissed', () => {
  const only = verifiedDiagnostic('diagnostic-only', 'Only diagnostic');
  const focusDiagnostic = vi.fn(() => true);

  render(
    <StatefulDiagnosticsPanel
      focusDiagnostic={focusDiagnostic}
      initialDiagnostics={[only]}
    />,
  );

  const region = screen.getByRole('region', { name: 'Writing guidance' });
  const dismissOnly = screen.getByRole('button', {
    name: 'Dismiss Only diagnostic',
  });
  dismissOnly.focus();
  fireEvent.click(dismissOnly);

  expect(region).toHaveFocus();
  expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  expect(screen.getByText('0 writing diagnostics')).toBeVisible();
  expect(focusDiagnostic).not.toHaveBeenCalled();
});
