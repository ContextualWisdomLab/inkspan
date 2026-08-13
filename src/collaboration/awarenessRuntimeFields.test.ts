import { describe, expect, it } from 'vitest';
import { serializeCollaborationUser } from './awareness.js';

const VALID_USER = {
  userId: 'editor-alice',
  displayName: 'Alice',
  cursorColor: '#123456',
};

describe('collaboration user runtime field contract', () => {
  it.each([
    ['userId', 42, 'collaboration userId must be a string'],
    ['displayName', {}, 'collaboration displayName must be a string'],
    ['cursorColor', null, 'collaboration cursorColor must be a string'],
  ] as const)(
    'rejects malformed %s before normalization',
    (field, value, message) => {
      expect(() =>
        serializeCollaborationUser({
          ...VALID_USER,
          [field]: value,
        } as never),
      ).toThrowError(new Error(message));
    },
  );

  it('preserves valid trimming, bounded names, and lowercase colors', () => {
    expect(
      serializeCollaborationUser({
        userId: '  editor-alice  ',
        displayName: `  ${'A'.repeat(81)}  `,
        cursorColor: '  #ABCDEF  ',
      }),
    ).toEqual({
      id: 'editor-alice',
      name: 'A'.repeat(80),
      color: '#abcdef',
    });
  });
});
