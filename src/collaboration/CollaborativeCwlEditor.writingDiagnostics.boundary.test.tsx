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
} from './types.js';

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
  revision: NonNullable<
    Awaited<ReturnType<CwlEditorHandle['getDocumentEnvelopeRevision']>>
  >,
  id = 'shared-diagnostic',
  replacement = 'Omega',
): CwlWritingDiagnostic {
  return {
    diagnosticId: id,
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
    title: 'Clarify the shared action',
    explanation: 'State the requested action explicitly.',
    suggestedReplacement: replacement,
    provenance: {
      workflowId: 'email-writing-review',
      workflowVersion: '1',
      judgePolicyVersion: 'evaluation-only-1',
    },
  };
}

class FakeAwareness implements CollaborationAwareness {
  readonly clientID = 101;
  readonly states = new Map<number, Record<string, unknown>>();
  private localState: Record<string, unknown> | null = null;
  private readonly listeners: Record<
    CollaborationAwarenessEvent,
    Set<(...args: unknown[]) => void>
  > = {
    change: new Set(),
    update: new Set(),
  };

  getLocalState(): Record<string, unknown> | null {
    return this.localState;
  }

  getStates(): Map<number, Record<string, unknown>> {
    return this.states;
  }

  setLocalStateField(field: string, value: unknown): void {
    this.localState = { ...(this.localState ?? {}), [field]: value };
    this.states.set(this.clientID, this.localState);
    for (const listener of this.listeners.change) listener({}, 'test');
    for (const listener of this.listeners.update) listener({}, 'test');
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

function providerWith(awareness: FakeAwareness): CollaborationProviderLike {
  return { awareness };
}

function reactActWarnings(
  consoleError: ReturnType<typeof vi.spyOn>,
): string[] {
  return consoleError.mock.calls
    .map((arguments_) => arguments_.map(String).join(' '))
    .filter((message) => message.includes('not wrapped in act'));
}

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('CollaborativeCwlEditor writing-diagnostic boundaries', () => {
  it('rejects an older digest when a remote Yjs transaction lands while revision verification is pending', async () => {
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
          writingDiagnosticsLabel="Digest-race guidance"
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

    const originalDigest = globalThis.crypto.subtle.digest.bind(
      globalThis.crypto.subtle,
    );
    let releaseDigest!: () => void;
    const digestGate = new Promise<void>((resolve) => {
      releaseDigest = resolve;
    });
    const digestStarted = vi.fn();
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(
      async (algorithm, data) => {
        digestStarted();
        const result = originalDigest(algorithm, data);
        await digestGate;
        return result;
      },
    );

    mounted.rerender(renderEditors([diagnostic(revision!)]));
    await waitFor(() => expect(digestStarted).toHaveBeenCalled());
    act(() => leftRef.current!.insertValue('<p>Remote race edit</p>'));
    await waitFor(() =>
      expect(rightRef.current!.getHTML()).toContain('Remote race edit'),
    );
    releaseDigest();

    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Digest-race guidance' }),
      ).toHaveTextContent('0 writing diagnostics'),
    );
    await expect(
      rightRef.current!.applyWritingDiagnostic('shared-diagnostic'),
    ).resolves.toBeNull();

    mounted.unmount();
    disconnect();
  });

  it('keeps editor identity stable and keeps diagnostics out of collaboration awareness', async () => {
    const document = new Y.Doc();
    const awareness = new FakeAwareness();
    const provider = providerWith(awareness);
    const editorRef = createRef<CwlEditorHandle>();
    const firstAction = vi.fn();
    const secondAction = vi.fn();

    const mounted = render(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={document}
        provider={provider}
        user={{
          userId: 'writer-one',
          displayName: 'Writer One',
          cursorColor: '#2563eb',
        }}
        mode="html"
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
    const originalEditor = editorRef.current!.getEditor();
    act(() => editorRef.current!.setValue('<p>Alpha beta gamma</p>'));
    const revision = await editorRef.current!.getDocumentEnvelopeRevision();
    expect(revision).not.toBeNull();

    mounted.rerender(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={document}
        provider={provider}
        user={{
          userId: 'writer-one',
          displayName: 'Writer One',
          cursorColor: '#2563eb',
        }}
        mode="html"
        writingDiagnostics={[diagnostic(revision!, 'identity-diagnostic')]}
        onWritingDiagnosticAction={firstAction}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Writing guidance' }),
      ).toHaveTextContent('1 writing diagnostics'),
    );
    expect(editorRef.current!.getEditor()).toBe(originalEditor);
    expect(awareness.getLocalState()).toEqual({
      user: {
        id: 'writer-one',
        name: 'Writer One',
        color: '#2563eb',
      },
    });

    mounted.rerender(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={document}
        provider={provider}
        user={{
          userId: 'writer-one',
          displayName: 'Writer One',
          cursorColor: '#2563eb',
        }}
        mode="html"
        writingDiagnostics={[diagnostic(revision!, 'identity-diagnostic')]}
        onWritingDiagnosticAction={secondAction}
      />,
    );
    expect(editorRef.current!.getEditor()).toBe(originalEditor);
    expect(awareness.getLocalState()).toEqual({
      user: {
        id: 'writer-one',
        name: 'Writer One',
        color: '#2563eb',
      },
    });
    expect(JSON.stringify(awareness.getLocalState())).not.toContain(
      'identity-diagnostic',
    );
    expect(JSON.stringify(awareness.getLocalState())).not.toContain('Omega');
  });

  it('emits an Apply action only on the client that explicitly invoked it', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
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
          writingDiagnosticsLabel="Left guidance"
          onWritingDiagnosticAction={leftAction}
        />
        <CollaborativeCwlEditor
          ref={rightRef}
          document={rightDocument}
          mode="html"
          writingDiagnostics={writingDiagnostics}
          writingDiagnosticsLabel="Right guidance"
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

    mounted.rerender(renderEditors([diagnostic(revision!)]));
    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: 'Left guidance' }),
      ).toHaveTextContent('1 writing diagnostics');
      expect(
        screen.getByRole('region', { name: 'Right guidance' }),
      ).toHaveTextContent('1 writing diagnostics');
    });

    await expect(
      rightRef.current!.applyWritingDiagnostic('shared-diagnostic'),
    ).resolves.toMatchObject({
      action: 'applied',
      reasonCode: 'explicit',
      diagnosticId: 'shared-diagnostic',
    });
    await waitFor(() => {
      expect(leftRef.current!.getHTML()).toContain('Omega beta gamma');
      expect(rightRef.current!.getHTML()).toContain('Omega beta gamma');
    });
    expect(rightAction).toHaveBeenCalledTimes(1);
    expect(leftAction).not.toHaveBeenCalled();
    expect(reactActWarnings(consoleError)).toEqual([]);

    mounted.unmount();
    disconnect();
  });
});
