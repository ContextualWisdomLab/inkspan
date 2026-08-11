import { describe, expect, it, vi } from 'vitest';
import { isStrongHttpEntityTag } from './package.js';

const MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS = 64 * 1024;

describe('durable autosave entity-tag resource boundary', () => {
  it('rejects an obviously oversized validator before regex evaluation', () => {
    const regexTest = vi.spyOn(RegExp.prototype, 'test');
    const oversizedCandidate = `"${'a'.repeat(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS)}"`;

    expect(isStrongHttpEntityTag(oversizedCandidate)).toBe(false);
    expect(regexTest).not.toHaveBeenCalled();

    regexTest.mockRestore();
  });

  it('preserves a syntactically valid validator at the exact ceiling', () => {
    const exactCandidate = `"${'a'.repeat(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS - 2)}"`;

    expect(exactCandidate).toHaveLength(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS);
    expect(isStrongHttpEntityTag(exactCandidate)).toBe(true);
  });
});
