import { describe, expect, it, vi } from 'vitest';
import { serializeCollaborationUser } from './awareness.js';

const MAX_LOCAL_FIELD_SOURCE_CODE_UNITS = 1_024;

/** Prove impossible local identity metadata is rejected before full-string trim. */
describe('local collaboration awareness source bounds', () => {
  it.each(['userId', 'displayName', 'cursorColor'] as const)(
    'rejects oversized %s before normalization',
    (field) => {
      const originalTrim = String.prototype.trim;
      let oversizedTrimObserved = false;
      const trimSpy = vi
        .spyOn(String.prototype, 'trim')
        .mockImplementation(function (this: string) {
          if (this.length > MAX_LOCAL_FIELD_SOURCE_CODE_UNITS) {
            oversizedTrimObserved = true;
          }
          return originalTrim.call(this);
        });
      const user = {
        userId: 'editor-alice',
        displayName: 'Alice',
        cursorColor: '#123456',
        [field]: ' '.repeat(MAX_LOCAL_FIELD_SOURCE_CODE_UNITS + 1),
      };

      try {
        expect(() => serializeCollaborationUser(user)).toThrow();
        expect(oversizedTrimObserved).toBe(false);
      } finally {
        trimSpy.mockRestore();
      }
    },
  );
});
