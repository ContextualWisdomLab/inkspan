import { describe, expect, it } from 'vitest';
import { serializeCollaborationUser } from './collaboration/index.js';

describe('public collaboration awareness contract', () => {
  it('enforces bounded public presence metadata through the package entrypoint', () => {
    const displayName = `${'A'.repeat(80)}extra`;

    expect(
      serializeCollaborationUser({
        userId: 'editor-alice',
        displayName,
        cursorColor: '#2563eb',
      }),
    ).toEqual({
      id: 'editor-alice',
      name: 'A'.repeat(80),
      color: '#2563eb',
    });

    expect(() =>
      serializeCollaborationUser({
        userId: `editor-${'a'.repeat(74)}`,
        displayName: 'Alice',
        cursorColor: '#2563eb',
      }),
    ).toThrow(/userId.*80/);
  });
});
