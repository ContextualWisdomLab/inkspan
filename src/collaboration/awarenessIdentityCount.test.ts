import { describe, expect, it } from 'vitest';
import { countRemoteCollaborators } from './awareness.js';
import type { CollaborationAwareness } from './types.js';

describe('collaboration awareness identity counting', () => {
  it('excludes remote identities that violate the public identifier contract', () => {
    const states = new Map<number, Record<string, unknown>>([
      [11, { user: { id: 'local-editor' } }],
      [12, { user: { id: '   ' } }],
      [13, { user: { id: '12345' } }],
      [14, { user: { id: `editor-${'a'.repeat(74)}` } }],
      [15, { user: { id: 'editor-bob' } }],
    ]);
    const awareness: CollaborationAwareness = {
      clientID: 11,
      states,
      getLocalState: () => states.get(11) ?? null,
      getStates: () => states,
      setLocalStateField: () => undefined,
      on: () => undefined,
      off: () => undefined,
    };

    expect(countRemoteCollaborators(awareness)).toBe(1);
  });
});
