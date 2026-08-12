import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CwlEditorHandle } from '../types.js';
import type { CwlWritingDiagnostic } from '../writingDiagnostics.js';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

/** Capture exact current revision and text-position evidence for one selection. */
async function diagnosticForSelection(
  handle: CwlEditorHandle,
  title = 'Clarify the request',
): Promise<CwlWritingDiagnostic> {
  const evidence = await handle.getTextPositionSelectorEvidence();
  if (evidence === null) throw new Error('Missing selector evidence');
  return {
    diagnosticId: 'diagnostic-1',
    documentRevision: evidence.revision,
    textProjection: evidence.textProjection,
    selector: evidence.selector,
    categoryCode: 'clarity',
    priority: 'important',
    title,
    explanation: 'State who should do what and by when.',
    suggestedReplacement: 'Please confirm the owner and due date.',
    provenance: {
      workflowId: 'email-writing-review',
      workflowVersion: '1',
      judgePolicyVersion: 'evaluation-only-1',
    },
  };
}

describe('CwlEditor host-supplied writing diagnostics', () => {
  it('creates no semantic guidance when the host omits diagnostics', async () => {
    render(
      <CwlEditor
        defaultValue="rude incorrect urgent 무례함 잘못됨 긴급"
        hideToolbar
      />,
    );

    await waitFor(() =>
      expect(document.querySelector('.cwl-editor__content')).not.toBeNull(),
    );
    expect(screen.queryByRole('region', { name: /writing/i })).toBeNull();
    expect(document.querySelector('.cwl-writing-diagnostic')).toBeNull();
  });

  it('renders an explicitly supplied empty diagnostic set as advisory UI', async () => {
    render(
      <CwlEditor
        defaultValue="Alpha beta"
        hideToolbar
        writingDiagnostics={[]}
        writingDiagnosticsLabel="Email writing guidance"
      />,
    );

    expect(
      await screen.findByRole('region', { name: 'Email writing guidance' }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 writing diagnostics')).toBeInTheDocument();
  });

  it('renders a diagnostic only after exact revision verification', async () => {
    const handleRef = createRef<CwlEditorHandle>();
    const onWritingDiagnosticAction = vi.fn();
    const view = render(
      <CwlEditor
        defaultValue="Alpha beta"
        hideToolbar
        ref={handleRef}
        onWritingDiagnosticAction={onWritingDiagnosticAction}
      />,
    );
    await waitFor(() => expect(handleRef.current?.getEditor()).not.toBeNull());

    act(() => {
      handleRef.current!.getEditor()!.commands.setTextSelection({
        from: 1,
        to: 6,
      });
    });
    const diagnostic = await diagnosticForSelection(handleRef.current!);

    view.rerender(
      <CwlEditor
        defaultValue="Alpha beta"
        hideToolbar
        ref={handleRef}
        writingDiagnostics={[diagnostic]}
        writingDiagnosticsLabel="Email writing guidance"
        onWritingDiagnosticAction={onWritingDiagnosticAction}
      />,
    );

    expect(
      await screen.findByRole('region', { name: 'Email writing guidance' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Clarify the request')).toBeInTheDocument();
    expect(document.querySelectorAll('.cwl-writing-diagnostic')).toHaveLength(1);
    expect(onWritingDiagnosticAction).not.toHaveBeenCalled();
  });
});
