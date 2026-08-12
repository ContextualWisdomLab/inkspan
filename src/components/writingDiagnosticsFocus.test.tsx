import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CwlVerifiedWritingDiagnostic,
  WritingDiagnosticsController,
} from './useWritingDiagnosticsController.js';
import { WritingDiagnosticsPanel } from './WritingDiagnosticsPanel.js';

const digestHex = '4a'.repeat(32);
const verifiedDiagnostic: CwlVerifiedWritingDiagnostic = Object.freeze({
  diagnostic: Object.freeze({
    diagnosticId: 'focus-diagnostic',
    documentRevision: Object.freeze({
      algorithm: 'SHA-256' as const,
      digestHex,
      strongEntityTag: `"sha256-${digestHex}"`,
    }),
    textProjection: Object.freeze({
      id: 'inkspan-prosemirror-text' as const,
      version: 1 as const,
    }),
    selector: Object.freeze({
      type: 'TextPositionSelector' as const,
      start: 0,
      end: 5,
    }),
    categoryCode: 'clarity',
    priority: 'important' as const,
    title: 'Clarify Alpha',
    explanation: 'Clarify the selected text.',
    provenance: Object.freeze({
      workflowId: 'writing-review',
      workflowVersion: '1',
      judgePolicyVersion: '1',
    }),
  }),
  from: 1,
  to: 6,
});

function buildEditorProbe() {
  const chain = {
    setTextSelection: vi.fn(),
    focus: vi.fn(),
    run: vi.fn(() => true),
  };
  chain.setTextSelection.mockReturnValue(chain);
  chain.focus.mockReturnValue(chain);
  const editor = {
    chain: vi.fn(() => chain),
  } as unknown as Editor;
  return { editor, chain };
}

function buildController(
  editor: Editor,
  focusResult: boolean,
): WritingDiagnosticsController {
  return {
    status: 'active',
    generation: 7,
    editor,
    diagnostics: [verifiedDiagnostic],
    digestProvider: null,
    focusDiagnostic: vi.fn(() => focusResult),
    applyDiagnostic: vi.fn(async () => null),
    ignoreDiagnostic: vi.fn(() => null),
    dismissDiagnostic: vi.fn(() => null),
    requestDiagnosticExplanation: vi.fn(() => null),
  };
}

afterEach(cleanup);

describe('WritingDiagnosticsPanel affected-text focus', () => {
  it('selects the verified range and focuses the editor after controller acceptance', () => {
    const { editor, chain } = buildEditorProbe();
    const controller = buildController(editor, true);
    render(
      <WritingDiagnosticsPanel
        controller={controller}
        label="Writing guidance"
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Focus affected text for Clarify Alpha',
      }),
    );

    expect(controller.focusDiagnostic).toHaveBeenCalledWith('focus-diagnostic');
    expect(editor.chain).toHaveBeenCalledTimes(1);
    expect(chain.setTextSelection).toHaveBeenCalledWith({ from: 1, to: 6 });
    expect(chain.focus).toHaveBeenCalledTimes(1);
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('does not move editor selection when the revision-bound controller rejects focus', () => {
    const { editor, chain } = buildEditorProbe();
    const controller = buildController(editor, false);
    render(
      <WritingDiagnosticsPanel
        controller={controller}
        label="Writing guidance"
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Focus affected text for Clarify Alpha',
      }),
    );

    expect(controller.focusDiagnostic).toHaveBeenCalledWith('focus-diagnostic');
    expect(editor.chain).not.toHaveBeenCalled();
    expect(chain.run).not.toHaveBeenCalled();
  });
});
