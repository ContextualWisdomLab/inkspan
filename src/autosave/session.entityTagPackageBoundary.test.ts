import { describe, expect, it } from 'vitest';
import { isStrongHttpEntityTag } from './package.js';

const MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS = 64 * 1024;

describe('framework-free autosave entity-tag package boundary', () => {
  it('exposes the same fail-closed ceiling through the standalone package barrel', () => {
    const atCeiling = `"${'p'.repeat(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS - 2)}"`;
    const beyondCeiling = `"${'p'.repeat(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS - 1)}"`;

    expect(isStrongHttpEntityTag(atCeiling)).toBe(true);
    expect(isStrongHttpEntityTag(beyondCeiling)).toBe(false);
  });
});
