import { describe, expect, it } from 'vitest';
import { serializeCollaborationUser } from './awareness.js';
import type { CollaborationUser } from './types.js';

describe('local collaboration user failure redaction', () => {
  it.each(['userId', 'displayName', 'cursorColor'] as const)(
    'normalizes a hostile %s property failure without reflecting the thrown value',
    (field) => {
      const privateFailure = { marker: 'private-local-user-sentinel' };
      const user = new Proxy<CollaborationUser>(
        {
          userId: 'editor-alice',
          displayName: 'Alice',
          cursorColor: '#123456',
        },
        {
          get(target, property, receiver) {
            if (property === field) throw privateFailure;
            return Reflect.get(target, property, receiver);
          },
        },
      );

      let caught: unknown;
      try {
        serializeCollaborationUser(user);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect(caught).not.toBe(privateFailure);
      expect((caught as Error).message).toBe(
        `collaboration ${field} must be a string`,
      );
      expect((caught as Error).message).not.toContain(
        'private-local-user-sentinel',
      );
    },
  );
});
