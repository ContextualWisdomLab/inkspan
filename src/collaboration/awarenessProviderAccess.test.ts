import { describe, expect, it } from 'vitest';
import {
  assertCollaborationConfiguration,
  createScopedCollaborationProvider,
} from './awareness.js';
import type {
  CollaborationAwareness,
  CollaborationProviderLike,
} from './types.js';

function validAwareness(): CollaborationAwareness {
  const states = new Map<number, Record<string, unknown>>();
  return {
    clientID: 11,
    states,
    getLocalState: () => null,
    getStates: () => states,
    setLocalStateField: () => undefined,
    on: () => undefined,
    off: () => undefined,
  };
}

describe('collaboration provider capability access', () => {
  it('does not leak a private provider error when awareness changes after validation', () => {
    const awareness = validAwareness();
    let reads = 0;
    const provider = Object.defineProperty({}, 'awareness', {
      enumerable: true,
      get() {
        reads += 1;
        if (reads === 1) return awareness;
        throw new Error('sensitive-provider-internal');
      },
    }) as CollaborationProviderLike;

    expect(() =>
      assertCollaborationConfiguration(provider, undefined),
    ).not.toThrow();
    expect(() => createScopedCollaborationProvider(provider)).toThrowError(
      new Error(
        'collaboration provider must expose a compatible Yjs awareness instance',
      ),
    );
  });

  it('normalizes private structural awareness access failures', () => {
    const privateFailure = new Error('sensitive-awareness-internal');
    const awareness = Object.defineProperty({}, 'clientID', {
      enumerable: true,
      get() {
        throw privateFailure;
      },
    }) as CollaborationAwareness;
    const provider = { awareness } as CollaborationProviderLike;

    let observed: unknown;
    try {
      assertCollaborationConfiguration(provider, undefined);
    } catch (error) {
      observed = error;
    }

    expect(observed).toBeInstanceOf(Error);
    expect(observed).not.toBe(privateFailure);
    expect((observed as Error).message).toBe(
      'collaboration provider must expose a compatible Yjs awareness instance',
    );
  });
});
