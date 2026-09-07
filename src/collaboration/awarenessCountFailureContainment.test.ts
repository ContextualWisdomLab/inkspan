import { describe, expect, it } from 'vitest';
import { countRemoteCollaborators } from './awareness.js';
import type { CollaborationAwareness } from './types.js';

function baseAwareness(): CollaborationAwareness {
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

describe('remote collaborator count failure containment', () => {
  it('fails closed without leaking getStates failures', () => {
    const privateFailure = { secret: 'provider-get-states-private' };
    const awareness = {
      ...baseAwareness(),
      getStates: () => {
        throw privateFailure;
      },
    };

    let observed: unknown;
    let count: number | undefined;
    try {
      count = countRemoteCollaborators(awareness);
    } catch (error) {
      observed = error;
    }

    expect(observed).toBeUndefined();
    expect(count).toBe(0);
  });

  it('fails closed without leaking clientID access failures', () => {
    const privateFailure = { secret: 'provider-client-id-private' };
    const states = new Map<number, Record<string, unknown>>([
      [12, { user: { id: 'remote-one' } }],
    ]);
    const awareness = {
      ...baseAwareness(),
      states,
      getStates: () => states,
    } as CollaborationAwareness;
    Object.defineProperty(awareness, 'clientID', {
      enumerable: true,
      get() {
        throw privateFailure;
      },
    });

    let observed: unknown;
    let count: number | undefined;
    try {
      count = countRemoteCollaborators(awareness);
    } catch (error) {
      observed = error;
    }

    expect(observed).toBeUndefined();
    expect(count).toBe(0);
  });
});
