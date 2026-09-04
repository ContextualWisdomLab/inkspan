import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { CwlEditorHandle } from '../types.js';
import type { CwlWritingDiagnostic } from '../writingDiagnostics.js';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';
import type {
  CollaborationAwareness,
  CollaborationAwarenessEvent,
  CollaborationProviderLike,
  CollaborationUser,
} from './types.js';

class FakeAwareness implements CollaborationAwareness {
  readonly clientID: number;
  readonly states = new Map<number, Record<string, unknown>>();
  private localState: Record<string, unknown> | null = null;
  private readonly listeners: Record<
    CollaborationAwarenessEvent,
    Set<(...args: unknown[]) => void>
  > = {
    change: new Set(),
    update: new Set(),
  };

  constructor(clientID = 1) {
    this.clientID = clientID;
  }

  getLocalState(): Record<string, unknown> | null {
    return this.localState;
  }

  getStates(): Map<number, Record<string, unknown>> {
    return this.states;
  }

  setLocalStateField(field: string, value: unknown): void {
    this.localState = { ...(this.localState ?? {}), [field]: value };
    this.states.set(this.clientID, this.localState);
    for (const event of ['change', 'update'] as const) {
      for (const listener of this.listeners[event]) listener({}, 'test');
    }
  }

  on(
    event: CollaborationAwarenessEvent,
    listener: (...args: unknown[]) => void,
  ): void {
    this.listeners[event].add(listener);
  }

  off(
    event: CollaborationAwarenessEvent,
    listener: (...args: unknown[]) => void,
  ): void {
    this.listeners[event].delete(listener);
  }
}

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

async function diagnosticFor(
  handle: CwlEditorHandle,
  diagnosticId = 'collaborative-race-diagnostic',
): Promise<CwlWritingDiagnostic> {
  act(() => {
    handle.getEditor()!.commands.setTextSelection({ from: 1, to: 6 });
  });
  const evidence = await handle.getTextPositionSelectorEvidence();
  if (evidence === null) throw new Error('Missing collaborative selector evidence');
  return {
    diagnosticId,
    documentRevision: evidence.revision,
    textProjection: evidence.textProjection,
    selector: evidence.selector,
    categoryCode: 'clarity',
    priority: 'important',
    title: 'Clarify the shared request',
    explanation: 'Make the shared action explicit.',
    suggestedReplacement: 'Omega',
    provenance: {
      workflowId: 'email-writing-review',
      workflowVersion: '1',
      judgePolicyVersion: 'evaluation-only-1',
    },
  };
}

const ALICE: CollaborationUser = {
  userId: 'editor-alice',
  displayName: 'Alice',
  cursorColor: '#2563eb',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CollaborativeCwlEditor diagnostic race and privacy boundaries', () => {
  it('blocks a local apply when a remote update arrives while both revision digests are pending', async () => {
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
          writingDiagnosticsLabel="Left race guidance"
          onWritingDiagnosticAction={leftAction}
        />
        <CollaborativeCwlEditor
          ref={rightRef}
          document={rightDocument}
          mode="html"
          writingDiagnostics={writingDiagnostics}
          writingDiagnosticsLabel="Right race guidance"
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
    const diagnostic = await diagnosticFor(rightRef.current!);

    mounted.rerender(renderEditors([diagnostic]));
    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: 'Left race guidance' }),
      ).toHaveTextContent('1 writing diagnostics');
      expect(
        screen.getByRole('region', { name: 'Right race guidance' }),
      ).toHaveTextContent('1 writing diagnostics');
    });

    const originalDigest = globalThis.crypto.subtle.digest.bind(
      globalThis.crypto.subtle,
    );
    const pending: Array<{
      algorithm: AlgorithmIdentifier;
      source: BufferSource;
      resolve: (value: ArrayBuffer) => void;
    }> = [];
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(
      (algorithm, source) =>
        new Promise<ArrayBuffer>((resolve) => {
          pending.push({ algorithm, source, resolve });
        }),
    );

    let application!: ReturnType<CwlEditorHandle['applyWritingDiagnostic']>;
    act(() => {
      application = rightRef.current!.applyWritingDiagnostic(
        'collaborative-race-diagnostic',
      );
    });
    await waitFor(() => expect(pending).toHaveLength(2));

    act(() => leftRef.current!.insertValue('!'));
    await waitFor(() => expect(rightRef.current!.getHTML()).toContain('!'));

    await act(async () => {
      for (const request of pending) {
        request.resolve(await originalDigest(request.algorithm, request.source));
      }
    });
    let event = null;
    await act(async () => {
      event = await application;
    });

    expect(event).toMatchObject({
      action: 'conflict',
      reasonCode: 'document_changed',
      diagnosticId: 'collaborative-race-diagnostic',
    });
    expect(leftRef.current!.getHTML()).not.toContain('Omega');
    expect(rightRef.current!.getHTML()).not.toContain('Omega');
    expect(rightAction).toHaveBeenCalledWith(event);
    expect(leftAction).not.toHaveBeenCalled();
    expect(
      screen.getByRole('region', { name: 'Left race guidance' }),
    ).toHaveTextContent('0 writing diagnostics');
    expect(
      screen.getByRole('region', { name: 'Right race guidance' }),
    ).toHaveTextContent('0 writing diagnostics');

    mounted.unmount();
    disconnect();
  });

  it('keeps diagnostics out of awareness and uses the latest callback without recreating or owning host resources', async () => {
    const collaborationDocument = new Y.Doc();
    const destroy = vi.spyOn(collaborationDocument, 'destroy');
    const awareness = new FakeAwareness(10);
    const provider: CollaborationProviderLike = { awareness };
    const editorRef = createRef<CwlEditorHandle>();
    const firstAction = vi.fn();
    const secondAction = vi.fn();

    const mounted = render(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={collaborationDocument}
        provider={provider}
        user={ALICE}
        mode="html"
        onWritingDiagnosticAction={firstAction}
      />,
    );
    await waitFor(() => {
      expect(editorRef.current?.getEditor()).toBeTruthy();
      expect(awareness.getLocalState()?.user).toEqual({
        id: 'editor-alice',
        name: 'Alice',
        color: '#2563eb',
      });
    });
    const editorIdentity = editorRef.current!.getEditor();
    act(() => editorRef.current!.setValue('<p>Alpha beta gamma</p>'));
    const diagnostic = await diagnosticFor(editorRef.current!, 'awareness-diagnostic');

    mounted.rerender(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={collaborationDocument}
        provider={provider}
        user={ALICE}
        mode="html"
        writingDiagnostics={[diagnostic]}
        writingDiagnosticsLabel="Awareness-safe guidance"
        onWritingDiagnosticAction={firstAction}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Awareness-safe guidance' }),
      ).toHaveTextContent('1 writing diagnostics'),
    );
    expect(editorRef.current!.getEditor()).toBe(editorIdentity);

    const serializedAwareness = JSON.stringify(awareness.getLocalState());
    for (const forbidden of [
      diagnostic.diagnosticId,
      diagnostic.title,
      diagnostic.explanation,
      diagnostic.suggestedReplacement!,
      diagnostic.documentRevision.digestHex,
      diagnostic.provenance.workflowId,
    ]) {
      expect(serializedAwareness).not.toContain(forbidden);
    }

    mounted.rerender(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={collaborationDocument}
        provider={provider}
        user={ALICE}
        mode="html"
        writingDiagnostics={[diagnostic]}
        writingDiagnosticsLabel="Awareness-safe guidance"
        onWritingDiagnosticAction={secondAction}
      />,
    );
    expect(editorRef.current!.getEditor()).toBe(editorIdentity);

    let explanation = null;
    act(() => {
      explanation = editorRef.current!.requestWritingDiagnosticExplanation(
        'awareness-diagnostic',
      );
    });
    expect(explanation).toMatchObject({
      action: 'requested_explanation',
      diagnosticId: 'awareness-diagnostic',
    });
    expect(secondAction).toHaveBeenCalledWith(explanation);
    expect(firstAction).not.toHaveBeenCalled();

    mounted.unmount();
    expect(destroy).not.toHaveBeenCalled();
  });
});
