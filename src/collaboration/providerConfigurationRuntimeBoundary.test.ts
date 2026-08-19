import { describe, expect, it } from 'vitest';
import { assertCollaborationConfiguration } from './awareness.js';
import type { CollaborationProviderLike } from './types.js';

describe('collaboration provider configuration runtime boundary', () => {
  it('redacts failures while reading the host awareness capability', () => {
    const privateFailure = new Error('private host capability detail');
    const provider = Object.defineProperty({}, 'awareness', {
      enumerable: true,
      get: () => {
        throw privateFailure;
      },
    }) as CollaborationProviderLike;

    let thrown: unknown;
    try {
      assertCollaborationConfiguration(provider, undefined);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBe(privateFailure);
    expect((thrown as Error).message).toBe(
      'collaboration provider must expose a compatible Yjs awareness instance',
    );
  });
});
