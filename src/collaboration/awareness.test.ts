import { describe, expect, it, vi } from 'vitest';
import {
  assertCollaborationConfiguration,
  collaborationConnectionLabel,
  contrastingTextColor,
  countRemoteCollaborators,
  createScopedCollaborationProvider,
  renderCollaborationCursor,
  serializeCollaborationUser,
} from './awareness.js';
import type {
  CollaborationAwareness,
  CollaborationAwarenessEvent,
  CollaborationProviderLike,
} from './types.js';

function validAwareness(
  states: Map<number, Record<string, unknown>> = new Map(),
): CollaborationAwareness {
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

describe('collaboration awareness validation', () => {
  it('serializes only the allowlisted public cursor fields', () => {
    expect(
      serializeCollaborationUser({
        userId: '  editor-alice  ',
        displayName: '  Alice  ',
        cursorColor: '#AABBCC',
      }),
    ).toEqual({ id: 'editor-alice', name: 'Alice', color: '#aabbcc' });
  });

  it.each([
    [
      { userId: ' ', displayName: 'Alice', cursorColor: '#123456' },
      /must not be empty/,
    ],
    [
      { userId: '12345', displayName: 'Alice', cursorColor: '#123456' },
      /nonnumeric/,
    ],
    [
      { userId: 'alice', displayName: ' ', cursorColor: '#123456' },
      /displayName/,
    ],
    [
      { userId: 'alice', displayName: 'Alice', cursorColor: 'red' },
      /six-digit/,
    ],
  ])('rejects invalid public user data %#', (user, expected) => {
    expect(() => serializeCollaborationUser(user)).toThrow(expected);
  });

  it('allows collaboration without an awareness provider', () => {
    expect(() =>
      assertCollaborationConfiguration(undefined, undefined),
    ).not.toThrow();
  });

  it('requires a provider when a public user is supplied', () => {
    expect(() =>
      assertCollaborationConfiguration(undefined, {
        userId: 'alice',
        displayName: 'Alice',
        cursorColor: '#123456',
      }),
    ).toThrow(/requires an awareness provider/);
  });

  it('accepts a structurally compatible provider', () => {
    expect(() =>
      assertCollaborationConfiguration(
        { awareness: validAwareness() },
        undefined,
      ),
    ).not.toThrow();
  });

  it.each([
    undefined,
    {},
    { clientID: 'bad' },
    { clientID: 1, states: {} },
    { clientID: 1, states: new Map(), getLocalState: null },
    {
      clientID: 1,
      states: new Map(),
      getLocalState: () => null,
      getStates: null,
    },
    {
      clientID: 1,
      states: new Map(),
      getLocalState: () => null,
      getStates: () => new Map(),
      setLocalStateField: null,
    },
    {
      clientID: 1,
      states: new Map(),
      getLocalState: () => null,
      getStates: () => new Map(),
      setLocalStateField: () => undefined,
      on: null,
    },
    {
      clientID: 1,
      states: new Map(),
      getLocalState: () => null,
      getStates: () => new Map(),
      setLocalStateField: () => undefined,
      on: () => undefined,
      off: null,
    },
  ] as unknown[])('rejects an incompatible awareness shape %#', (awareness) => {
    const provider = { awareness } as unknown as CollaborationProviderLike;
    expect(() =>
      assertCollaborationConfiguration(provider, undefined),
    ).toThrow(/compatible Yjs awareness/);
  });
});

describe('scoped collaboration provider', () => {
  it('relays awareness events and delegates state without leaking listeners', () => {
    const states = new Map<number, Record<string, unknown>>([
      [5, { user: { id: 'local' } }],
    ]);
    let localState: Record<string, unknown> | null = null;
    const sourceListeners: Record<
      CollaborationAwarenessEvent,
      Set<(...args: unknown[]) => void>
    > = {
      change: new Set(),
      update: new Set(),
    };
    const source: CollaborationAwareness = {
      clientID: 5,
      states,
      getLocalState: () => localState,
      getStates: () => states,
      setLocalStateField: (field, value) => {
        localState = { ...(localState ?? {}), [field]: value };
      },
      on: (event, listener) => sourceListeners[event].add(listener),
      off: (event, listener) => sourceListeners[event].delete(listener),
    };
    const scoped = createScopedCollaborationProvider({ awareness: source });
    const onChange = vi.fn();
    const removedChange = vi.fn();
    const onUpdate = vi.fn();

    scoped.awareness.on('change', onChange);
    scoped.awareness.on('change', removedChange);
    scoped.awareness.off('change', removedChange);
    scoped.awareness.on('update', onUpdate);
    for (const listener of sourceListeners.change) listener('changed');
    for (const listener of sourceListeners.update) listener('updated');

    expect(onChange).toHaveBeenCalledWith('changed');
    expect(removedChange).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith('updated');
    expect(scoped.awareness.clientID).toBe(5);
    expect(scoped.awareness.states).toBe(states);
    expect(scoped.awareness.getStates()).toBe(states);
    expect(scoped.awareness.getLocalState()).toBeNull();

    scoped.awareness.setLocalStateField('user', { id: 'editor-alice' });
    expect(scoped.awareness.getLocalState()).toEqual({
      user: { id: 'editor-alice' },
    });

    expect(sourceListeners.change.size).toBe(1);
    expect(sourceListeners.update.size).toBe(1);
    scoped.dispose();
    expect(sourceListeners.change.size).toBe(0);
    expect(sourceListeners.update.size).toBe(0);

    scoped.dispose();
    expect(sourceListeners.change.size).toBe(0);
  });
});

describe('collaboration awareness presentation', () => {
  it('counts only remote clients with nonempty public identifiers', () => {
    const states = new Map<number, Record<string, unknown>>([
      [11, { user: { id: 'local' } }],
      [12, { user: { id: 'remote-one' } }],
      [13, { user: { id: '' } }],
      [14, { user: { id: 99 } }],
      [15, { user: null }],
      [16, { user: 'bad' }],
      [17, {}],
      [18, { user: { id: 'remote-two' } }],
    ]);
    const awareness = validAwareness(states);

    expect(countRemoteCollaborators(awareness)).toBe(2);
    expect(countRemoteCollaborators(undefined)).toBe(0);
  });

  it.each([
    ['connecting', 'Connecting'],
    ['connected', 'Connected'],
    ['disconnected', 'Disconnected'],
    ['offline', 'Offline'],
    [undefined, 'Collaboration ready'],
  ] as const)('maps %s to a concise connection label', (status, label) => {
    expect(collaborationConnectionLabel(status)).toBe(label);
  });

  it('renders a text-only high-contrast cursor for valid remote data', () => {
    const cursor = renderCollaborationCursor({
      name: 'Remote Alice',
      color: '#ffffff',
    });
    const label = cursor.querySelector('.collaboration-cursor__label');

    expect(cursor).toHaveClass('collaboration-cursor__caret');
    expect(cursor.style.borderColor).toBe('rgb(255, 255, 255)');
    expect(label).toHaveTextContent('Remote Alice');
    expect((label as HTMLElement).style.color).toBe('rgb(0, 0, 0)');
  });

  it('sanitizes malformed remote awareness without injecting markup', () => {
    const cursor = renderCollaborationCursor({
      name: '<img src=x onerror=alert(1)>'.repeat(8),
      color: 'url(javascript:alert(1))',
    });
    const label = cursor.querySelector(
      '.collaboration-cursor__label',
    ) as HTMLElement;

    expect(cursor.style.borderColor).toBe('rgb(71, 85, 105)');
    expect(label.textContent).toHaveLength(80);
    expect(label.querySelector('img')).toBeNull();
  });

  it('falls back for blank and non-string remote names', () => {
    expect(
      renderCollaborationCursor({ name: ' ', color: '#000000' }).textContent,
    ).toBe('Collaborator');
    expect(
      renderCollaborationCursor({ name: 7, color: '#000000' }).textContent,
    ).toBe('Collaborator');
  });

  it('selects contrasting black and white label text', () => {
    expect(contrastingTextColor('#ffffff')).toBe('#000000');
    expect(contrastingTextColor('#000000')).toBe('#ffffff');
    expect(contrastingTextColor('#777777')).toBe('#000000');
  });
});
