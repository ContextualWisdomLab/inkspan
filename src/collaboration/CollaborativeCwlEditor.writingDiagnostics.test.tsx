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
import * as Y from 'yjs';
import type { CwlEditorDocumentRevision } from '../documentEnvelopeRevision.js';
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
): CwlWritingDiagnostic {
  return {
    diagnosticId: 'collaborative-diagnostic',
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
    title: 'Clarify the shared request',
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
  it('applies an exact-revision replacement through Yjs, converges, and remains undoable', async () => {
    const leftDocument = new Y.Doc();
    const rightDocument = new Y.Doc();
    const disconnect = connectDocuments(leftDocument, rightDocument);
    const leftRef = createRef<CwlEditorHandle>();
    const rightRef = createRef<CwlEditorHandle>();
    const onAction = vi.fn();

    const renderEditors = (writingDiagnostics?: readonly CwlWritingDiagnostic[]) => (
      <div>
        <CollaborativeCwlEditor
          ref={leftRef}
          document={leftDocument}
          mode="html"
        />
        <CollaborativeCwlEditor
          ref={rightRef}
          document={rightDocument}
          mode="html"
          writingDiagnostics={writingDiagnostics}
          writingDiagnosticsLabel="Shared writing guidance"
          onWritingDiagnosticAction={onAction}
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

    mounted.rerender(renderEditors([diagnostic(revision!)]));
    const apply = await screen.findByRole('button', {
      name: 'Apply suggestion for Clarify the shared request',
    });
    expect(apply).toBeEnabled();

    fireEvent.click(apply);
    await waitFor(() => {
      expect(rightRef.current!.getHTML()).toContain('Omega beta gamma');
      expect(leftRef.current!.getHTML()).toContain('Omega beta gamma');
    });
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'applied',
        reasonCode: 'explicit',
        diagnosticId: 'collaborative-diagnostic',
        resultingDocumentRevision: expect.objectContaining({
          algorithm: 'SHA-256',
        }),
      }),
    );
    expect(
      screen.getByRole('region', { name: 'Shared writing guidance' }),
    ).toHaveTextContent('0 writing diagnostics');

    act(() => rightRef.current!.getEditor()!.commands.undo());
    await waitFor(() => {
      expect(rightRef.current!.getHTML()).toContain('Alpha beta gamma');
      expect(leftRef.current!.getHTML()).toContain('Alpha beta gamma');
    });

    mounted.unmount();
    disconnect();
  });

  it('invalidates current diagnostics when a remote Yjs update changes the document', async () => {
    const leftDocument = new Y.Doc();
    const rightDocument = new Y.Doc();
    const disconnect = connectDocuments(leftDocument, rightDocument);
    const leftRef = createRef<CwlEditorHandle>();
    const rightRef = createRef<CwlEditorHandle>();

    const renderEditors = (writingDiagnostics?: readonly CwlWritingDiagnostic[]) => (
      <div>
        <CollaborativeCwlEditor ref={leftRef} document={leftDocument} mode="html" />
        <CollaborativeCwlEditor
          ref={rightRef}
          document={rightDocument}
          mode="html"
          writingDiagnostics={writingDiagnostics}
          writingDiagnosticsLabel="Remote-safe guidance"
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

    mounted.rerender(renderEditors([diagnostic(revision!)]));
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Remote-safe guidance' }),
      ).toHaveTextContent('1 writing diagnostics'),
    );

    act(() => leftRef.current!.insertValue('<p>Remote edit</p>'));
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Remote-safe guidance' }),
      ).toHaveTextContent('0 writing diagnostics'),
    );
    await expect(
      rightRef.current!.applyWritingDiagnostic('collaborative-diagnostic'),
    ).resolves.toBeNull();
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
      name: 'Apply suggestion for Clarify the shared request',
    });
    expect(apply).toBeDisabled();
    await expect(
      editorRef.current!.applyWritingDiagnostic('collaborative-diagnostic'),
    ).resolves.toBeNull();
    expect(editorRef.current!.getHTML()).toBe(before);
  });
});
