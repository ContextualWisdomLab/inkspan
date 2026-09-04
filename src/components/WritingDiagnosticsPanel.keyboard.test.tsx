import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CwlVerifiedWritingDiagnostic,
  WritingDiagnosticsController,
} from './useWritingDiagnosticsController.js';
import { WritingDiagnosticsPanel } from './WritingDiagnosticsPanel.js';

const digestHex = '6b'.repeat(32);
const documentRevision = Object.freeze({
  algorithm: 'SHA-256' as const,
  digestHex,
  strongEntityTag: `"sha256-${digestHex}"`,
});
const textProjection = Object.freeze({
  id: 'inkspan-prosemirror-text' as const,
  version: 1 as const,
});

function diagnostic(
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
        end: 1,
      }),
      categoryCode: 'clarity',
      priority: 'advisory' as const,
      title,
      explanation: `${title} explanation`,
      provenance: Object.freeze({
        workflowId: 'writing-review',
        workflowVersion: '1',
        judgePolicyVersion: '1',
      }),
    }),
    from: 1,
    to: 2,
  });
}

function controller(
  diagnostics: readonly CwlVerifiedWritingDiagnostic[],
): WritingDiagnosticsController {
  return {
    status: 'active',
    generation: 3,
    editor: null,
    diagnostics,
    digestProvider: null,
    focusDiagnostic: vi.fn(() => true),
    ignoreDiagnostic: vi.fn(() => null),
    dismissDiagnostic: vi.fn(() => null),
    requestDiagnosticExplanation: vi.fn(() => null),
  };
}

afterEach(cleanup);

describe('WritingDiagnosticsPanel keyboard navigation', () => {
  it('supports ArrowUp, ArrowDown, Home, and End only from a diagnostic card', () => {
    const first = diagnostic('first', 'First');
    const second = diagnostic('second', 'Second');
    const third = diagnostic('third', 'Third');
    const activeController = controller([first, second, third]);

    render(
      <WritingDiagnosticsPanel
        controller={activeController}
        label="Writing guidance"
      />,
    );

    const items = screen.getAllByRole('listitem');
    act(() => {
      items[0]!.focus();
    });
    fireEvent.keyDown(items[0]!, { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    expect(activeController.focusDiagnostic).toHaveBeenLastCalledWith('second');

    fireEvent.keyDown(items[1]!, { key: 'End' });
    expect(items[2]).toHaveFocus();
    expect(activeController.focusDiagnostic).toHaveBeenLastCalledWith('third');

    fireEvent.keyDown(items[2]!, { key: 'Home' });
    expect(items[0]).toHaveFocus();
    expect(activeController.focusDiagnostic).toHaveBeenLastCalledWith('first');

    fireEvent.keyDown(items[0]!, { key: 'ArrowUp' });
    expect(items[2]).toHaveFocus();
    expect(activeController.focusDiagnostic).toHaveBeenLastCalledWith('third');

    const focusButton = screen.getByRole('button', {
      name: 'Focus affected text for First',
    });
    act(() => {
      focusButton.focus();
    });
    fireEvent.keyDown(focusButton, { key: 'ArrowDown' });
    expect(focusButton).toHaveFocus();
  });
});
