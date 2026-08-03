import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createScopedCollaborationProvider } from './awareness.js';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';
import type {
  CollaborationAwareness,
  CollaborationAwarenessEvent,
  CollaborativeCwlEditorProps,
} from './types.js';

afterEach(cleanup);

function createAwareness(): CollaborationAwareness {
  const states = new Map<number, Record<string, unknown>>();
  const listeners: Record<
    CollaborationAwarenessEvent,
    Set<(...args: unknown[]) => void>
  > = {
    change: new Set(),
    update: new Set(),
  };
  return {
    clientID: 23,
    states,
    getLocalState: () => null,
    getStates: () => states,
    setLocalStateField: () => undefined,
    on: (event, listener) => listeners[event].add(listener),
    off: (event, listener) => listeners[event].delete(listener),
  };
}

describe('collaboration defensive branches', () => {
  it('keeps duplicate and unknown scoped awareness listener operations idempotent', () => {
    const scoped = createScopedCollaborationProvider({
      awareness: createAwareness(),
    });
    const listener = vi.fn();
    const unknownListener = vi.fn();

    scoped.awareness.on('change', listener);
    scoped.awareness.on('change', listener);
    scoped.awareness.off('update', unknownListener);
    scoped.awareness.off('change', listener);
    scoped.awareness.off('change', listener);
    scoped.dispose();
  });

  it('accepts undefined legacy props and a provider without public presence', () => {
    const props = {
      document: new Y.Doc(),
      provider: { awareness: createAwareness() },
      value: undefined,
      defaultValue: undefined,
      hideToolbar: true,
    } as unknown as CollaborativeCwlEditorProps;

    render(<CollaborativeCwlEditor {...props} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Collaboration ready · 0 remote collaborators',
    );
  });

  it('rejects a missing collaboration document', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const props = {
      document: null,
    } as unknown as CollaborativeCwlEditorProps;

    expect(() => render(<CollaborativeCwlEditor {...props} />)).toThrow(
      /must be a Y.Doc/,
    );
    consoleError.mockRestore();
  });
});
