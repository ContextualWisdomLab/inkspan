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

  it('rejects over-depth array children before reading their descriptors', () => {
    const deepestArray: readonly unknown[] = Object.freeze([null]);
    let root: readonly unknown[] = deepestArray;
    for (let depth = 0; depth < 128; depth += 1) {
      root = Object.freeze([root]);
    }

    const getOwnPropertyDescriptor = vi.spyOn(
      Object,
      'getOwnPropertyDescriptor',
    );
    try {
      expect(isDeeplyFrozenDocumentJson(root)).toBe(false);
      expect(
        getOwnPropertyDescriptor.mock.calls.some(
          ([value, property]) => value === deepestArray && property === '0',
        ),
      ).toBe(false);
    } finally {
      getOwnPropertyDescriptor.mockRestore();
    }
  });

  it('rejects over-depth object children before reading their descriptors', () => {
    const deepestObject = Object.freeze({ child: null });
    let root: Readonly<{ child: unknown }> = deepestObject;
    for (let depth = 0; depth < 128; depth += 1) {
      root = Object.freeze({ child: root });
    }

    const getOwnPropertyDescriptor = vi.spyOn(
      Object,
      'getOwnPropertyDescriptor',
    );
    try {
      expect(isDeeplyFrozenDocumentJson(root)).toBe(false);
      expect(
        getOwnPropertyDescriptor.mock.calls.some(
          ([value, property]) => value === deepestObject && property === 'child',
        ),
      ).toBe(false);
    } finally {
      getOwnPropertyDescriptor.mockRestore();
    }
  });

  it('accepts an empty object exactly at the maximum nesting depth', () => {
    const deepestObject = Object.freeze({});
    let root: Readonly<Record<string, unknown>> = deepestObject;
    for (let depth = 0; depth < 128; depth += 1) {
      root = Object.freeze({ child: root });
    }

    expect(isDeeplyFrozenDocumentJson(root)).toBe(true);
  });
});
