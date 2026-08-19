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
});
