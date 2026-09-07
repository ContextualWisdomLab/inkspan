import { describe, expect, it } from 'vitest';

import { toDesignTokenFormatGroup } from './designTokens.js';

describe('design-token interchange snapshot immutability', () => {
  it('freezes nested font-family values before returning them to hosts', () => {
    const group = toDesignTokenFormatGroup();
    const fontValue = group.cwl.font.$value;

    expect(Array.isArray(fontValue)).toBe(true);
    expect(Object.isFrozen(fontValue)).toBe(true);
    expect(() => (fontValue as string[]).push('Host mutation')).toThrow(TypeError);
  });
});
