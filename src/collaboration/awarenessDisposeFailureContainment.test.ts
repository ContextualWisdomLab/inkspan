import { describe, expect, it, vi } from 'vitest';
import { createScopedCollaborationProvider } from './awareness.js';
import type {
  CollaborationAwareness,
  CollaborationAwarenessEvent,
} from './types.js';

describe('scoped collaboration provider cleanup containment', () => {
  it('attempts every listener detachment without leaking host cleanup failures', () => {
    const privateFailure = new Error('sensitive-provider-cleanup-internal');
    const sourceListeners: Record<
      CollaborationAwarenessEvent,
      Set<(...args: unknown[]) => void>
    > = {
      change: new Set(),
      update: new Set(),
    };
    let offCalls = 0;
    const source: CollaborationAwareness = {
      clientID: 7,
      states: new Map(),
      getLocalState: () => null,
      getStates: () => new Map(),
      setLocalStateField: () => undefined,
      on: (event, listener) => sourceListeners[event].add(listener),
      off: (event, listener) => {
        offCalls += 1;
        if (event === 'change') throw privateFailure;
        sourceListeners[event].delete(listener);
      },
    };
    const scoped = createScopedCollaborationProvider({ awareness: source });
    const changeListener = vi.fn();
    const updateListener = vi.fn();

    scoped.awareness.on('change', changeListener);
    scoped.awareness.on('update', updateListener);

    let observed: unknown;
    try {
      scoped.dispose();
    } catch (error) {
      observed = error;
    }

    expect(observed).toBeUndefined();
    expect(offCalls).toBe(2);
    expect(sourceListeners.update.size).toBe(0);

    scoped.dispose();
    expect(offCalls).toBe(2);
  });
});
