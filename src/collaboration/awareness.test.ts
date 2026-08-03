import { describe, expect, it } from 'vitest';
import {
  assertCollaborationConfiguration,
  collaborationConnectionLabel,
  contrastingTextColor,
  countRemoteCollaborators,
  renderCollaborationCursor,
  serializeCollaborationUser,
} from './awareness.js';
import type {
  CollaborationAwareness,
  CollaborationProviderLike,
} from './types.js';

function validAwareness(): CollaborationAwareness {
  return {
    clientID: 11,
    getLocalState: () => null,
    getStates: () => new Map(),
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
    expect(() => assertCollaborationConfiguration(undefined, undefined)).not.toThrow();
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
    { clientID: 1, getLocalState: null },
    { clientID: 1, getLocalState: () => null, getStates: null },
    {
      clientID: 1,
      getLocalState: () => null,
      getStates: () => new Map(),
      setLocalStateField: null,
    },
    {
      clientID: 1,
      getLocalState: () => null,
      getStates: () => new Map(),
      setLocalStateField: () => undefined,
      on: null,
    },
    {
      clientID: 1,
      getLocalState: () => null,
      getStates: () => new Map(),
      setLocalStateField: () => undefined,
      on: () => undefined,
      off: null,
    },
  ])('rejects an incompatible awareness shape %#', (awareness) => {
    const provider = { awareness } as unknown as CollaborationProviderLike;
    expect(() =>
      assertCollaborationConfiguration(provider, undefined),
    ).toThrow(/compatible Yjs awareness/);
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
    const awareness = { ...validAwareness(), getStates: () => states };

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
    const label = cursor.querySelector('.collaboration-cursor__label') as HTMLElement;

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
