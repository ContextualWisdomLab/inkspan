import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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

function Harness({
  initialDiagnostics,
}: Readonly<{ initialDiagnostics: readonly CwlVerifiedWritingDiagnostic[] }>) {
  const [diagnostics, setDiagnostics] = useState(initialDiagnostics);
  const controller: WritingDiagnosticsController = {
    status: 'active',
    generation: 7,
    editor: null,
    diagnostics,
    digestProvider: null,
    focusDiagnostic: () => true,
    ignoreDiagnostic: () => null,
    dismissDiagnostic: (diagnosticId) => {
      const target = diagnostics.find(
        (candidate) => candidate.diagnostic.diagnosticId === diagnosticId,
      );
      if (target === undefined) return null;
      setDiagnostics((current) =>
        current.filter(
          (candidate) => candidate.diagnostic.diagnosticId !== diagnosticId,
        ),
      );
      return Object.freeze({
        action: 'dismissed' as const,
        reasonCode: 'explicit' as const,
        diagnosticId,
        documentRevision: target.diagnostic.documentRevision,
        categoryCode: target.diagnostic.categoryCode,
        generation: 8,
      });
    },
    requestDiagnosticExplanation: () => null,
  };

  return (
    <WritingDiagnosticsPanel controller={controller} label="Writing guidance" />
  );
}

afterEach(cleanup);

describe('WritingDiagnosticsPanel dismissal focus', () => {
  it('moves focus to the next diagnostic when the focused card is dismissed', () => {
    render(
      <Harness
        initialDiagnostics={[
          verifiedDiagnostic('first', 'First diagnostic'),
          verifiedDiagnostic('second', 'Second diagnostic'),
        ]}
      />,
    );

    const dismiss = screen.getByRole('button', { name: 'Dismiss First diagnostic' });
    dismiss.focus();
    expect(dismiss).toHaveFocus();

    fireEvent.click(dismiss);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Second diagnostic');
    expect(items[0]).toHaveFocus();
  });

  it('moves focus to the previous diagnostic when the last card is dismissed', () => {
    render(
      <Harness
        initialDiagnostics={[
          verifiedDiagnostic('first', 'First diagnostic'),
          verifiedDiagnostic('second', 'Second diagnostic'),
        ]}
      />,
    );

    const dismiss = screen.getByRole('button', { name: 'Dismiss Second diagnostic' });
    dismiss.focus();
    expect(dismiss).toHaveFocus();

    fireEvent.click(dismiss);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('First diagnostic');
    expect(items[0]).toHaveFocus();
  });

  it('moves focus to the guidance region when the only card is dismissed', () => {
    render(
      <Harness
        initialDiagnostics={[verifiedDiagnostic('only', 'Only diagnostic')]}
      />,
    );

    const dismiss = screen.getByRole('button', { name: 'Dismiss Only diagnostic' });
    dismiss.focus();
    expect(dismiss).toHaveFocus();

    fireEvent.click(dismiss);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(
      screen.getByRole('region', { name: 'Writing guidance' }),
    ).toHaveFocus();
  });
});
