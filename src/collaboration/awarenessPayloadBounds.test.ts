import { describe, expect, it, vi } from 'vitest';
import {
  renderCollaborationCursor,
  serializeCollaborationUser,
} from './awareness.js';

describe('collaboration awareness payload bounds', () => {
  it('limits the broadcast display name to the rendered cursor-label ceiling', () => {
    const serialized = serializeCollaborationUser({
      userId: 'editor-alice',
      displayName: ` ${'A'.repeat(81)} `,
      cursorColor: '#123456',
    });

    expect(serialized.name).toBe('A'.repeat(80));
    expect(serialized.name).toHaveLength(80);
  });

  it('does not split Unicode scalar values at the cursor-label ceiling', () => {
    const expected = `${'A'.repeat(79)}😀`;
    const oversized = `${expected}tail`;

    const serialized = serializeCollaborationUser({
      userId: 'editor-alice',
      displayName: oversized,
      cursorColor: '#123456',
    });
    const remoteCursor = renderCollaborationCursor({
      name: oversized,
      color: '#123456',
    });

    expect(serialized.name).toBe(expected);
    expect(remoteCursor.textContent).toBe(expected);
  });

  it('accepts an 80-code-point public identifier even when UTF-16 is longer', () => {
    const userId = `${'a'.repeat(79)}😀`;

    expect(
      serializeCollaborationUser({
        userId,
        displayName: 'Alice',
        cursorColor: '#123456',
      }).id,
    ).toBe(userId);
  });

  it('rejects oversized public identifiers before awareness publication', () => {
    expect(() =>
      serializeCollaborationUser({
        userId: `editor-${'a'.repeat(74)}`,
        displayName: 'Alice',
        cursorColor: '#123456',
      }),
    ).toThrow(/userId.*80/);
  });

  it('does not materialize code-point arrays while enforcing public bounds', () => {
    const arrayFrom = vi.spyOn(Array, 'from');
    let thrown: unknown;

    try {
      serializeCollaborationUser({
        userId: `editor-${'a'.repeat(1_000)}`,
        displayName: 'A'.repeat(1_000),
        cursorColor: '#123456',
      });
    } catch (error) {
      thrown = error;
    }

    const allocationCalls = arrayFrom.mock.calls.length;
    arrayFrom.mockRestore();

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/userId.*80/);
    expect(allocationCalls).toBe(0);
  });
});
