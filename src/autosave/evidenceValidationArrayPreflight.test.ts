import { describe, expect, it, vi } from 'vitest';

import { isDeeplyFrozenDocumentJson } from './evidenceValidation.js';

describe('autosave detached evidence array resource preflight', () => {
  it('rejects an impossible array length before explicit own-key enumeration', () => {
    const oversizedArray = new Array<unknown>(1_000_001);
    Object.freeze(oversizedArray);

    const ownKeys = vi.spyOn(Reflect, 'ownKeys');
    try {
      expect(isDeeplyFrozenDocumentJson(oversizedArray)).toBe(false);
      expect(ownKeys).not.toHaveBeenCalledWith(oversizedArray);
    } finally {
      ownKeys.mockRestore();
    }
  });
});
