import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { CwlEditorDocumentRevision } from '../documentEnvelopeRevision.js';
import { writingDiagnosticsPluginKey } from '../extensions/WritingDiagnostics.js';
import type { CwlEditorHandle } from '../types.js';
import type { CwlWritingDiagnostic } from '../writingDiagnostics.js';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';

function connectDocuments(left: Y.Doc, right: Y.Doc): () => void {
  const forward = (update: Uint8Array, origin: unknown) => {
    if (origin !== right) Y.applyUpdate(right, update, left);
  };
  const reverse = (update: Uint8Array, origin: unknown) => {
    if (origin !== left) Y.applyUpdate(left, update, right);
  };
  left.on('update', forward);
  right.on('update', reverse);
  return () => {
    left.off('update', forward);
    right.off('update', reverse);
  };
}

function diagnostic(
  revision: CwlEditorDocumentRevision,
  replacement = 'Omega',
  diagnosticId = 'collaborative-diagnostic',
): CwlWritingDiagnostic {
  return {
    diagnosticId,
    documentRevision: revision,
    textProjection: {
      id: 'inkspan-prosemirror-text',
      version: 1,
    },
    selector: {
      type: 'TextPositionSelector',
      start: 0,
      end: 5,
    },
    categoryCode: 'clarity',
    priority: 'important',
    title: `Clarify the shared request ${diagnosticId}`,
    explanation: 'Make the shared action explicit.',
    suggestedReplacement: replacement,
    provenance: {
      workflowId: 'email-writing-review',
      workflowVersion: '1',
      judgePolicyVersion: 'evaluation-only-1',
    },
  };
}

afterEach(cleanup);

describe('CollaborativeCwlEditor writing diagnostics', () => {
  it('applies through Yjs, converges, and preserves collaborative undo/redo without fabricating remote actions', async () => {
    const leftDocument = new Y.Doc();
    const rightDocument = new Y.Doc();
    const disconnect = connectDocuments(leftDocument, rightDocument);
    const leftRef = createRef<CwlEditorHandle>();
    const rightRef = createRef<CwlEditorHandle>();
    const leftAction = vi.fn();
    const rightAction = vi.fn();

    const renderEditors = (writingDiagnostics?: readonly CwlWritingDiagnostic[]) => (
      <div>
        <CollaborativeCwlEditor
          ref={leftRef}
          document={leftDocument}
          mode="html"
          writingDiagnostics={writingDiagnostics}
          writingDiagnosticsLabel="Left shared guidance"
          onWritingDiagnosticAction={leftAction}
        />
        <CollaborativeCwlEditor
          ref={rightRef}
          document={rightDocument}
          mode="html"
          writingDiagnostics={writingDiagnostics}
          writingDiagnosticsLabel="Right shared guidance"
          onWritingDiagnosticAction={rightAction}
        />
      </div>
    );

    const mounted = render(renderEditors());
    await waitFor(() => {
      expect(leftRef.current?.getEditor()).toBeTruthy();
      expect(rightRef.current?.getEditor()).toBeTruthy();
    });

    act(() => leftRef.current!.setValue('<p>Alpha beta gamma</p>'));
    await waitFor(() =>
      expect(rightRef.current!.getHTML()).toContain('Alpha beta gamma'),
    );
    const revision = await rightRef.current!.getDocumentEnvelopeRevision();
    expect(revision).not.toBeNull();
    const sharedDiagnostic = diagnostic(revision!);

    mounted.rerender(renderEditors([sharedDiagnostic]));
    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: 'Left shared guidance' }),
      ).toHaveTextContent('1 writing diagnostics');
      expect(
        screen.getByRole('region', { name: 'Right shared guidance' }),
      ).toHaveTextContent('1 writing diagnostics');
    });
    const apply = within(
      screen.getByRole('region', { name: 'Right shared guidance' }),
    ).getByRole('button', {
      name: 'Apply suggestion for Clarify the shared request collaborative-diagnostic',
    });
    expect(apply).toBeEnabled();

    fireEvent.click(apply);
    await waitFor(() => {
      expect(rightRef.current!.getHTML()).toContain('Omega beta gamma');
      expect(leftRef.current!.getHTML()).toContain('Omega beta gamma');
    });
    expect(rightAction).toHaveBeenCalledTimes(1);
    expect(rightAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'applied',
        reasonCode: 'explicit',
        diagnosticId: 'collaborative-diagnostic',
        resultingDocumentRevision: expect.objectContaining({
          algorithm: 'SHA-256',
        }),
      }),
    );
    expect(leftAction).not.toHaveBeenCalled();
    expect(
      screen.getByRole('region', { name: 'Left shared guidance' }),
    ).toHaveTextContent('0 writing diagnostics');
    expect(
      screen.getByRole('region', { name: 'Right shared guidance' }),
    ).toHaveTextContent('0 writing diagnostics');

    act(() => {
      expect(rightRef.current!.getEditor()!.commands.undo()).toBe(true);
    });
    await waitFor(() => {
      expect(rightRef.current!.getHTML()).toContain('Alpha beta gamma');
      expect(leftRef.current!.getHTML()).toContain('Alpha beta gamma');
    });
    expect(rightAction).toHaveBeenCalledTimes(1);
    expect(leftAction).not.toHaveBeenCalled();

    act(() => {
      expect(rightRef.current!.getEditor()!.commands.redo()).toBe(true);
    });
    await waitFor(() => {
      expect(rightRef.current!.getHTML()).toContain('Omega beta gamma');
      expect(leftRef.current!.getHTML()).toContain('Omega beta gamma');
    });
    expect(rightAction).toHaveBeenCalledTimes(1);
    expect(leftAction).not.toHaveBeenCalled();

    mounted.unmount();
    disconnect();
  });

  it('invalidates every current diagnostic when a remote Yjs update changes the document', async () => {
    const leftDocument = new Y.Doc();
    const rightDocument = new Y.Doc();
    const disconnect = connectDocuments(leftDocument, rightDocument);
    const leftRef = createRef<CwlEditorHandle>();
    const rightRef = createRef<CwlEditorHandle>();
    const rightAction = vi.fn();

    const renderEditors = (writingDiagnostics?: readonly CwlWritingDiagnostic[]) => (
      <div>
        <CollaborativeCwlEditor ref={leftRef} document={leftDocument} mode="html" />
        <CollaborativeCwlEditor
          ref={rightRef}
          document={rightDocument}
          mode="html"
          writingDiagnostics={writingDiagnostics}
          writingDiagnosticsLabel="Remote-safe guidance"
          onWritingDiagnosticAction={rightAction}
        />
      </div>
    );

    const mounted = render(renderEditors());
    await waitFor(() => {
      expect(leftRef.current?.getEditor()).toBeTruthy();
      expect(rightRef.current?.getEditor()).toBeTruthy();
    });
    act(() => leftRef.current!.setValue('<p>Alpha beta gamma</p>'));
    await waitFor(() =>
      expect(rightRef.current!.getHTML()).toContain('Alpha beta gamma'),
    );
    const revision = await rightRef.current!.getDocumentEnvelopeRevision();
    expect(revision).not.toBeNull();
    const diagnostics = [
      diagnostic(revision!, 'Omega', 'remote-diagnostic-one'),
      diagnostic(revision!, 'Sigma', 'remote-diagnostic-two'),
    ];

    mounted.rerender(renderEditors(diagnostics));
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Remote-safe guidance' }),
      ).toHaveTextContent('2 writing diagnostics'),
    );
    expect(
      writingDiagnosticsPluginKey.getState(
        rightRef.current!.getEditor()!.state,
      )?.diagnostics,
    ).toHaveLength(2);

    act(() => leftRef.current!.insertValue('<p>Remote edit</p>'));
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Remote-safe guidance' }),
      ).toHaveTextContent('0 writing diagnostics'),
    );
    expect(
      writingDiagnosticsPluginKey.getState(
        rightRef.current!.getEditor()!.state,
      )?.diagnostics,
    ).toEqual([]);
    await expect(
      rightRef.current!.applyWritingDiagnostic('remote-diagnostic-one'),
    ).resolves.toBeNull();
    await expect(
      rightRef.current!.applyWritingDiagnostic('remote-diagnostic-two'),
    ).resolves.toBeNull();
    expect(rightAction).not.toHaveBeenCalled();
    expect(rightRef.current!.getHTML()).toContain('Remote edit');
    expect(rightRef.current!.getHTML()).toContain('Alpha beta gamma');

    mounted.unmount();
    disconnect();
  });

  it('keeps collaborative replacement actions disabled and inert in read-only mode', async () => {
    const document = new Y.Doc();
    const editorRef = createRef<CwlEditorHandle>();
    const mounted = render(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={document}
        mode="html"
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
    act(() => editorRef.current!.setValue('<p>Alpha beta gamma</p>'));
    const revision = await editorRef.current!.getDocumentEnvelopeRevision();
    expect(revision).not.toBeNull();
    const before = editorRef.current!.getHTML();

    mounted.rerender(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={document}
        mode="html"
        editable={false}
        writingDiagnostics={[diagnostic(revision!)]}
        writingDiagnosticsLabel="Read-only shared guidance"
      />,
    );
    const apply = await screen.findByRole('button', {
      name: 'Apply suggestion for Clarify the shared request collaborative-diagnostic',
    });
    expect(apply).toBeDisabled();
    await expect(
      editorRef.current!.applyWritingDiagnostic('collaborative-diagnostic'),
    ).resolves.toBeNull();
    expect(editorRef.current!.getHTML()).toBe(before);
  });
});
