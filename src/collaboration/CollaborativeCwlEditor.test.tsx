import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { base64ImagePluginKey } from '../extensions/Base64Image.js';
import type { CwlEditorHandle } from '../types.js';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';
import type {
  CollaborationAwareness,
  CollaborationAwarenessEvent,
  CollaborationProviderLike,
  CollaborationUser,
  CollaborativeCwlEditorProps,
} from './types.js';

afterEach(cleanup);

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
    this.emit('change');
    this.emit('update');
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

  setRemoteState(clientID: number, state: Record<string, unknown>): void {
    this.states.set(clientID, state);
    this.emit('change');
    this.emit('update');
  }

  removeRemoteState(clientID: number): void {
    this.states.delete(clientID);
    this.emit('change');
    this.emit('update');
  }

  listenerCount(): number {
    return this.listeners.change.size + this.listeners.update.size;
  }

  private emit(event: CollaborationAwarenessEvent): void {
    for (const listener of this.listeners[event]) listener({}, 'test');
  }
}

function providerWith(awareness: FakeAwareness): CollaborationProviderLike {
  return { awareness };
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

const ALICE: CollaborationUser = {
  userId: 'editor-alice',
  displayName: 'Alice',
  cursorColor: '#2563eb',
};

function expectRenderFailure(
  props: Record<string, unknown>,
  message: RegExp,
): void {
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  expect(() =>
    render(
      <CollaborativeCwlEditor
        {...(props as unknown as CollaborativeCwlEditorProps)}
      />,
    ),
  ).toThrow(message);
  consoleError.mockRestore();
}

describe('CollaborativeCwlEditor contract', () => {
  it('rejects static value and defaultValue initialization', () => {
    expectRenderFailure(
      { document: new Y.Doc(), value: '<p>bad</p>' },
      /sole source of truth/,
    );
    expectRenderFailure(
      { document: new Y.Doc(), defaultValue: '<p>bad</p>' },
      /sole source of truth/,
    );
  });

  it('rejects an empty field and a non-Yjs document', () => {
    expectRenderFailure(
      { document: new Y.Doc(), field: ' ' },
      /field must not be empty/,
    );
    expectRenderFailure({ document: {} }, /must be a Y.Doc/);
  });

  it('mounts without a provider and replaces StarterKit history with CRDT history', async () => {
    const onReady = vi.fn();
    const editorRef = createRef<CwlEditorHandle>();
    render(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={new Y.Doc()}
        onReady={onReady}
      />,
    );

    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
    const editor = editorRef.current!.getEditor()!;
    const extensionNames = editor.extensionManager.extensions.map(
      (extension) => extension.name,
    );

    expect(extensionNames).toContain('collaboration');
    expect(extensionNames).not.toContain('history');
    expect(onReady).toHaveBeenCalledWith(editor);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Collaboration ready · 0 remote collaborators',
    );
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('publishes allowlisted awareness, updates identity without recreating the editor, and announces presence', async () => {
    const collaborationDocument = new Y.Doc();
    const awareness = new FakeAwareness(10);
    const provider = providerWith(awareness);
    const onReady = vi.fn();
    const { rerender, unmount } = render(
      <CollaborativeCwlEditor
        document={collaborationDocument}
        provider={provider}
        user={ALICE}
        connectionStatus="connected"
        onReady={onReady}
      />,
    );

    await waitFor(() =>
      expect(awareness.getLocalState()?.user).toEqual({
        id: 'editor-alice',
        name: 'Alice',
        color: '#2563eb',
      }),
    );
    const initialEditor = onReady.mock.calls[0]![0];

    act(() => {
      awareness.setRemoteState(20, {
        user: { id: 'editor-bob', name: 'Bob', color: '#dc2626' },
      });
    });
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Connected · 1 remote collaborator',
      ),
    );

    rerender(
      <CollaborativeCwlEditor
        document={collaborationDocument}
        provider={provider}
        user={{
          userId: 'editor-alice',
          displayName: 'Alice Updated',
          cursorColor: '#16a34a',
        }}
        connectionStatus="disconnected"
        onReady={onReady}
      />,
    );

    await waitFor(() =>
      expect(awareness.getLocalState()?.user).toEqual({
        id: 'editor-alice',
        name: 'Alice Updated',
        color: '#16a34a',
      }),
    );
    expect(onReady.mock.calls.at(-1)![0]).toBe(initialEditor);
    expect(screen.getByRole('status')).toHaveTextContent('Disconnected');

    act(() => awareness.removeRemoteState(20));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '0 remote collaborators',
      ),
    );
    expect(awareness.listenerCount()).toBeGreaterThan(0);
    unmount();
    expect(awareness.listenerCount()).toBe(0);
  });

  it('keeps read-only textbox semantics while hiding editing controls', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={new Y.Doc()}
        editable={false}
        hideToolbar
        ariaLabel="Shared report"
        connectionStatus="offline"
      />,
    );

    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Shared report' }),
    ).toHaveAttribute('contenteditable', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('Offline');
  });
});

describe('CollaborativeCwlEditor convergence and lifecycle', () => {
  it('converges rich text, shares undo, merges concurrent edits, and preserves host-owned documents across remount', async () => {
    const leftDocument = new Y.Doc();
    const rightDocument = new Y.Doc();
    let disconnect = connectDocuments(leftDocument, rightDocument);
    const leftRef = createRef<CwlEditorHandle>();
    const rightRef = createRef<CwlEditorHandle>();
    const leftChange = vi.fn();
    const destroySpy = vi.spyOn(leftDocument, 'destroy');

    const mounted = render(
      <div>
        <CollaborativeCwlEditor
          ref={leftRef}
          document={leftDocument}
          mode="html"
          onChange={leftChange}
        />
        <CollaborativeCwlEditor
          ref={rightRef}
          document={rightDocument}
          mode="html"
        />
      </div>,
    );
    await waitFor(() => {
      expect(leftRef.current?.getEditor()).toBeTruthy();
      expect(rightRef.current?.getEditor()).toBeTruthy();
    });

    const richHtml =
      '<p>Shared paragraph</p><ul><li>Shared list</li></ul>' +
      '<table><tbody><tr><th>Metric</th><td>42</td></tr></tbody></table>' +
      '<p><img src="data:image/png;base64,iVBORw0KGgo=" alt="inline" /></p>';
    act(() => leftRef.current!.setValue(richHtml));
    await waitFor(() => {
      expect(rightRef.current!.getHTML()).toContain('Shared paragraph');
      expect(rightRef.current!.getHTML()).toContain('<table');
      expect(rightRef.current!.getHTML()).toContain('data:image/png;base64');
    });
    expect(leftChange).toHaveBeenCalled();

    act(() => leftRef.current!.insertValue('<p>Undo this sentence</p>'));
    await waitFor(() =>
      expect(rightRef.current!.getHTML()).toContain('Undo this sentence'),
    );
    act(() => leftRef.current!.getEditor()!.commands.undo());
    await waitFor(() =>
      expect(rightRef.current!.getHTML()).not.toContain('Undo this sentence'),
    );

    disconnect();
    act(() => leftRef.current!.insertValue('<p>Left concurrent edit</p>'));
    act(() => rightRef.current!.insertValue('<p>Right concurrent edit</p>'));
    const leftState = Y.encodeStateAsUpdate(leftDocument);
    const rightState = Y.encodeStateAsUpdate(rightDocument);
    act(() => {
      Y.applyUpdate(leftDocument, rightState);
      Y.applyUpdate(rightDocument, leftState);
    });
    await waitFor(() => {
      expect(leftRef.current!.getHTML()).toBe(rightRef.current!.getHTML());
      expect(leftRef.current!.getHTML()).toContain('Left concurrent edit');
      expect(leftRef.current!.getHTML()).toContain('Right concurrent edit');
    });
    disconnect = connectDocuments(leftDocument, rightDocument);

    mounted.unmount();
    expect(destroySpy).not.toHaveBeenCalled();

    const remountedRef = createRef<CwlEditorHandle>();
    render(
      <CollaborativeCwlEditor
        ref={remountedRef}
        document={leftDocument}
        mode="html"
      />,
    );
    await waitFor(() =>
      expect(remountedRef.current?.getHTML()).toContain('Shared paragraph'),
    );
    expect(destroySpy).not.toHaveBeenCalled();
    disconnect();
  });

  it('keeps image errors live without recreating the collaborative document binding', async () => {
    const document = new Y.Doc();
    const editorRef = createRef<CwlEditorHandle>();
    const onImageError = vi.fn();
    const { rerender } = render(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={document}
        image={{ maxSizeBytes: 1, maxDimension: 0 }}
        hideToolbar
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

    const file = new File([new Uint8Array([1, 2, 3])], 'too-large.png', {
      type: 'image/png',
    });
    const paste = () => {
      const editor = editorRef.current!.getEditor()!;
      const plugin = base64ImagePluginKey.get(editor.state)!;
      return (
        plugin.props.handlePaste as (view: unknown, event: unknown) => boolean
      )(editor.view, {
        clipboardData: {
          items: [{ kind: 'file', getAsFile: () => file }],
        },
        preventDefault: vi.fn(),
      });
    };

    expect(paste()).toBe(true);
    await act(async () => undefined);

    rerender(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={document}
        image={{ maxSizeBytes: 1, maxDimension: 0 }}
        hideToolbar
        onImageError={onImageError}
      />,
    );
    expect(paste()).toBe(true);
    await waitFor(() => expect(onImageError).toHaveBeenCalled());
  });
});
