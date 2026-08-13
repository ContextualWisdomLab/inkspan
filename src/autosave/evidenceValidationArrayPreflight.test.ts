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

  it('does not execute array length get traps while validating frozen evidence', () => {
    const target = Object.freeze([1]);
    let lengthRead = false;
    const proxiedArray = new Proxy(target, {
      get(currentTarget, property, receiver) {
        if (property === 'length') lengthRead = true;
        return Reflect.get(currentTarget, property, receiver);
      },
    });

    expect(isDeeplyFrozenDocumentJson(proxiedArray)).toBe(true);
    expect(lengthRead).toBe(false);
  });
});
