import { describe, expect, it } from 'vitest';
import { serializeCollaborationUser } from './awareness.js';

describe('collaboration awareness outbound payload bounds', () => {
  it('limits the broadcast display name to the rendered cursor-label ceiling', () => {
    const serialized = serializeCollaborationUser({
      userId: 'editor-alice',
      displayName: ` ${'A'.repeat(81)} `,
      cursorColor: '#123456',
    });

    expect(serialized.name).toBe('A'.repeat(80));
    expect(serialized.name).toHaveLength(80);
  });
});
