import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';
import type {
  CollaborationAwareness,
  CollaborationAwarenessEvent,
  CollaborationProviderLike,
} from './types.js';

afterEach(cleanup);

function awarenessWith(
  on: CollaborationAwareness['on'],
  off: CollaborationAwareness['off'],
): CollaborationAwareness {
  const states = new Map<number, Record<string, unknown>>();
  return {
    clientID: 23,
    states,
    getLocalState: () => null,
    getStates: () => states,
    setLocalStateField: () => undefined,
    on,
    off,
  };
}

describe('collaborative editor provider listener failure containment', () => {
  it('does not leak a private change-listener registration failure', () => {
    const privateFailure = new Error('sensitive-provider-on-internal');
    const awareness = awarenessWith(
      (_event: CollaborationAwarenessEvent) => {
        throw privateFailure;
      },
      () => undefined,
    );
    const provider: CollaborationProviderLike = { awareness };
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    let observed: unknown;
    try {
      render(
        <CollaborativeCwlEditor document={new Y.Doc()} provider={provider} />,
      );
    } catch (error) {
      observed = error;
    } finally {
      consoleError.mockRestore();
    }

    expect(observed).toBeUndefined();
  });

  it('does not leak a private change-listener cleanup failure', () => {
    const privateFailure = new Error('sensitive-provider-off-internal');
    let offCalls = 0;
    const awareness = awarenessWith(
      () => undefined,
      () => {
        offCalls += 1;
        throw privateFailure;
      },
    );
    const provider: CollaborationProviderLike = { awareness };
    const mounted = render(
      <CollaborativeCwlEditor document={new Y.Doc()} provider={provider} />,
    );
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    let observed: unknown;
    try {
      mounted.unmount();
    } catch (error) {
      observed = error;
    } finally {
      consoleError.mockRestore();
    }

    expect(observed).toBeUndefined();
    expect(offCalls).toBeGreaterThan(0);
  });
});
