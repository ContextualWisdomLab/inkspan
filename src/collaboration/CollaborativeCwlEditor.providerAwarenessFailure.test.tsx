// @vitest-environment node

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';
import type {
  CollaborationAwareness,
  CollaborationProviderLike,
} from './types.js';

function validAwareness(): CollaborationAwareness {
  const states = new Map<number, Record<string, unknown>>();
  return {
    clientID: 17,
    states,
    getLocalState: () => null,
    getStates: () => states,
    setLocalStateField: () => undefined,
    on: () => undefined,
    off: () => undefined,
  };
}

describe('collaborative editor provider awareness access', () => {
  it('contains a private awareness getter failure after configuration validation', () => {
    const privateFailure = new Error('sensitive-provider-awareness-internal');
    const awareness = validAwareness();
    let reads = 0;
    const provider = Object.defineProperty({}, 'awareness', {
      enumerable: true,
      get() {
        reads += 1;
        if (reads === 1) return awareness;
        throw privateFailure;
      },
    }) as CollaborationProviderLike;

    let observed: unknown;
    try {
      renderToString(
        <CollaborativeCwlEditor document={new Y.Doc()} provider={provider} />,
      );
    } catch (error) {
      observed = error;
    }

    expect(observed).toBeUndefined();
    expect(reads).toBe(2);
  });
});
