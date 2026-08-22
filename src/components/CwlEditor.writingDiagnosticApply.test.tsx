import {
  act,
  cleanup,
  fireEvent,
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

async function exactDiagnostic(
  handle: CwlEditorHandle,
  replacement: string,
): Promise<CwlWritingDiagnostic> {
  const evidence = await handle.getTextPositionSelectorEvidence();
  if (evidence === null) throw new Error('Missing selector evidence');
  return {
    diagnosticId: 'apply-diagnostic',
    documentRevision: evidence.revision,
    textProjection: evidence.textProjection,
    selector: evidence.selector,
    categoryCode: 'clarity',
    priority: 'important',
    title: 'Clarify the request',
    explanation: 'Make the requested action explicit.',
    suggestedReplacement: replacement,
    provenance: {
      workflowId: 'email-writing-review',
      workflowVersion: '1',
      judgePolicyVersion: 'evaluation-only-1',
    },
  };
}

describe('CwlEditor writing-diagnostic application', () => {
  it('rechecks the exact revision, inserts plain text, invalidates diagnostics, and remains undoable', async () => {
    const handleRef: { current: CwlEditorHandle | null } = { current: null };
    const onAction = vi.fn();
    const onChange = vi.fn();
    const view = render(
      <CwlEditor
        defaultValue="Alpha beta"
        hideToolbar
        onChange={onChange}
        onWritingDiagnosticAction={onAction}
        ref={handleRef}
      />,
    );
    await waitFor(() => expect(handleRef.current?.getEditor()).not.toBeNull());

    act(() => {
      handleRef.current!.getEditor()!.commands.setTextSelection({ from: 1, to: 6 });
    });
    const hostileTagName = ['scr', 'ipt'].join('');
    const replacement = `<${hostileTagName}>alert(1)</${hostileTagName}>`;
    const diagnostic = await exactDiagnostic(handleRef.current!, replacement);

    view.rerender(
      <CwlEditor
        defaultValue="Alpha beta"
        hideToolbar
        onChange={onChange}
        onWritingDiagnosticAction={onAction}
        ref={handleRef}
        writingDiagnostics={[diagnostic]}
        writingDiagnosticsLabel="Email writing guidance"
      />,
    );

    const apply = await screen.findByRole('button', {
      name: 'Apply suggestion for Clarify the request',
    });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);

    await waitFor(() =>
      expect(handleRef.current?.getValue()).toBe(`${replacement} beta`),
    );
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('.cwl-writing-diagnostic')).toBeNull();
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'applied',
        reasonCode: 'explicit',
        diagnosticId: 'apply-diagnostic',
        resultingDocumentRevision: expect.objectContaining({
          algorithm: 'SHA-256',
        }),
      }),
    );
    expect(onChange).toHaveBeenCalled();

    act(() => {
      expect(handleRef.current!.getEditor()!.commands.undo()).toBe(true);
    });
    expect(handleRef.current?.getValue()).toBe('Alpha beta');
  });

  it('keeps replacement application disabled and inert in read-only mode', async () => {
    const handleRef = createRef<CwlEditorHandle>();
    const onAction = vi.fn();
    const view = render(
      <CwlEditor
        defaultValue="Alpha beta"
        editable={false}
        hideToolbar
        onWritingDiagnosticAction={onAction}
        ref={handleRef}
      />,
    );
    await waitFor(() => expect(handleRef.current?.getEditor()).not.toBeNull());

    act(() => {
      handleRef.current!.getEditor()!.commands.setTextSelection({ from: 1, to: 6 });
    });
    const diagnostic = await exactDiagnostic(handleRef.current!, 'Omega');

    view.rerender(
      <CwlEditor
        defaultValue="Alpha beta"
        editable={false}
        hideToolbar
        onWritingDiagnosticAction={onAction}
        ref={handleRef}
        writingDiagnostics={[diagnostic]}
      />,
    );

    const apply = await screen.findByRole('button', {
      name: 'Apply suggestion for Clarify the request',
    });
    expect(apply).toBeDisabled();
    await expect(
      handleRef.current!.applyWritingDiagnostic('apply-diagnostic'),
    ).resolves.toBeNull();
    expect(handleRef.current!.getValue()).toBe('Alpha beta');
    expect(onAction).not.toHaveBeenCalled();
    expect(document.querySelector('.cwl-writing-diagnostic')).not.toBeNull();
  });
});
