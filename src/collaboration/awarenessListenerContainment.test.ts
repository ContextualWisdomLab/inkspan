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

describe('scoped collaboration provider listener containment', () => {
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
});
