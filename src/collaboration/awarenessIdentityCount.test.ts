import { describe, expect, it, vi } from 'vitest';
import { countRemoteCollaborators } from './awareness.js';
import type { CollaborationAwareness } from './types.js';

function awarenessWith(
  states: Map<number, Record<string, unknown>>,
): CollaborationAwareness {
  return {
    clientID: 11,
    states,
    getLocalState: () => states.get(11) ?? null,
    getStates: () => states,
    setLocalStateField: () => undefined,
    on: () => undefined,
    off: () => undefined,
  };
}

describe('collaboration awareness identity counting', () => {
  it('excludes remote identities that violate the public identifier contract', () => {
    const states = new Map<number, Record<string, unknown>>([
      [11, { user: { id: 'local-editor' } }],
      [12, { user: { id: '   ' } }],
      [13, { user: { id: '12345' } }],
      [14, { user: { id: `editor-${'a'.repeat(74)}` } }],
      [15, { user: { id: 'editor-bob' } }],
      [16, { user: { id: `${'a'.repeat(79)}😀` } }],
    ]);

    expect(countRemoteCollaborators(awarenessWith(states))).toBe(2);
  });

  it('rejects oversized remote identifiers before normalization', () => {
    const oversizedId = `editor-${'a'.repeat(1_024)}`;
    const states = new Map<number, Record<string, unknown>>([
      [11, { user: { id: 'local-editor' } }],
      [12, { user: { id: oversizedId } }],
      [13, { user: { id: ' editor-bob ' } }],
    ]);
    const trimSpy = vi.spyOn(String.prototype, 'trim');

    try {
      expect(countRemoteCollaborators(awarenessWith(states))).toBe(1);
      expect(
        trimSpy.mock.instances.some(
          (receiver) => String(receiver) === oversizedId,
        ),
      ).toBe(false);
    } finally {
      trimSpy.mockRestore();
    }
  });

  it('skips accessor-backed remote identity fields without executing caller code', () => {
    let userGetterCalls = 0;
    let idGetterCalls = 0;
    const accessorBackedState: Record<string, unknown> = {};
    Object.defineProperty(accessorBackedState, 'user', {
      enumerable: true,
      get() {
        userGetterCalls += 1;
        throw new Error('private remote user getter must not execute');
      },
    });
    const accessorBackedUser: Record<string, unknown> = {};
    Object.defineProperty(accessorBackedUser, 'id', {
      enumerable: true,
      get() {
        idGetterCalls += 1;
        throw new Error('private remote id getter must not execute');
      },
    });
    const states = new Map<number, Record<string, unknown>>([
      [11, { user: { id: 'local-editor' } }],
      [12, accessorBackedState],
      [13, { user: accessorBackedUser }],
      [14, { user: { id: 'editor-bob' } }],
    ]);

    expect(countRemoteCollaborators(awarenessWith(states))).toBe(1);
    expect(userGetterCalls).toBe(0);
    expect(idGetterCalls).toBe(0);
  });

  it('ignores inherited and non-enumerable remote identity fields', () => {
    const inheritedState = Object.create({
      user: { id: 'editor-inherited' },
    }) as Record<string, unknown>;
    const nonEnumerableState: Record<string, unknown> = {};
    Object.defineProperty(nonEnumerableState, 'user', {
      enumerable: false,
      value: { id: 'editor-hidden' },
    });
    const nonEnumerableIdUser: Record<string, unknown> = {};
    Object.defineProperty(nonEnumerableIdUser, 'id', {
      enumerable: false,
      value: 'editor-hidden-id',
    });
    const states = new Map<number, Record<string, unknown>>([
      [11, { user: { id: 'local-editor' } }],
      [12, inheritedState],
      [13, nonEnumerableState],
      [14, { user: { name: 'missing-id' } }],
      [15, { user: nonEnumerableIdUser }],
      [16, { user: { id: 'editor-bob' } }],
    ]);

    expect(countRemoteCollaborators(awarenessWith(states))).toBe(1);
  });

  it('skips null and primitive remote states before descriptor reflection', () => {
    const runtimeStates = new Map<number, unknown>([
      [11, { user: { id: 'local-editor' } }],
      [12, null],
      [13, 'not-an-awareness-state'],
      [14, { user: { id: 'editor-bob' } }],
    ]);
    const states = runtimeStates as unknown as Map<
      number,
      Record<string, unknown>
    >;

    expect(countRemoteCollaborators(awarenessWith(states))).toBe(1);
  });

  it('skips reflection-hostile remote identity shapes without leaking failures', () => {
    const hostileState = new Proxy<Record<string, unknown>>(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('private remote descriptor trap must not escape');
        },
      },
    );
    const states = new Map<number, Record<string, unknown>>([
      [11, { user: { id: 'local-editor' } }],
      [12, hostileState],
      [13, { user: { id: 'editor-bob' } }],
    ]);

    expect(countRemoteCollaborators(awarenessWith(states))).toBe(1);
  });
});
