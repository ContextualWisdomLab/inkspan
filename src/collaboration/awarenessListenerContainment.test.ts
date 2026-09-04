import { describe, expect, it, vi } from 'vitest';
import { createScopedCollaborationProvider } from './awareness.js';
import type { CollaborationAwareness } from './types.js';

function awarenessWithListenerRegistrationFailure(): {
  awareness: CollaborationAwareness;
  registrationAttempts: () => number;
} {
  const states = new Map<number, Record<string, unknown>>();
  let attempts = 0;
  const privateFailure = new Error('private provider listener registration failure');
  const awareness: CollaborationAwareness = {
    clientID: 11,
    states,
    getLocalState: () => null,
    getStates: () => states,
    setLocalStateField: () => undefined,
    on: () => {
      attempts += 1;
      if (attempts === 1) throw privateFailure;
    },
    off: () => undefined,
  };
  return { awareness, registrationAttempts: () => attempts };
}

function awarenessWithListenerRemovalFailure(): {
  awareness: CollaborationAwareness;
  removalAttempts: () => number;
} {
  const states = new Map<number, Record<string, unknown>>();
  let attempts = 0;
  const privateFailure = new Error('private provider listener removal failure');
  const awareness: CollaborationAwareness = {
    clientID: 11,
    states,
    getLocalState: () => null,
    getStates: () => states,
    setLocalStateField: () => undefined,
    on: () => undefined,
    off: () => {
      attempts += 1;
      if (attempts === 1) throw privateFailure;
    },
  };
  return { awareness, removalAttempts: () => attempts };
}

describe('scoped collaboration provider listener containment', () => {
  it('removes a listener when the host registers it before throwing', () => {
    const states = new Map<number, Record<string, unknown>>();
    const listeners = new Set<(...args: unknown[]) => void>();
    const awareness: CollaborationAwareness = {
      clientID: 11,
      states,
      getLocalState: () => null,
      getStates: () => states,
      setLocalStateField: () => undefined,
      on: (_event, listener) => {
        listeners.add(listener);
        throw new Error('private post-registration failure');
      },
      off: (_event, listener) => {
        listeners.delete(listener);
      },
    };
    const scoped = createScopedCollaborationProvider({ awareness });
    const listener = vi.fn();

    expect(() => scoped.awareness.on('change', listener)).toThrowError(
      new Error('collaboration awareness listener registration failed'),
    );
    for (const registeredListener of listeners) registeredListener();

    expect(listener).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });

  it('redacts a rejected listener registration and permits a clean retry', () => {
    const source = awarenessWithListenerRegistrationFailure();
    const scoped = createScopedCollaborationProvider({ awareness: source.awareness });
    const listener = vi.fn();

    expect(() => scoped.awareness.on('change', listener)).toThrowError(
      new Error('collaboration awareness listener registration failed'),
    );
    expect(source.registrationAttempts()).toBe(1);

    expect(() => scoped.awareness.on('change', listener)).not.toThrow();
    expect(source.registrationAttempts()).toBe(2);
  });

  it('redacts a rejected listener removal and retains state for retry', () => {
    const source = awarenessWithListenerRemovalFailure();
    const scoped = createScopedCollaborationProvider({ awareness: source.awareness });
    const listener = vi.fn();

    scoped.awareness.on('change', listener);
    expect(() => scoped.awareness.off('change', listener)).toThrowError(
      new Error('collaboration awareness listener removal failed'),
    );
    expect(source.removalAttempts()).toBe(1);

    expect(() => scoped.awareness.off('change', listener)).not.toThrow();
    expect(source.removalAttempts()).toBe(2);
  });
});
