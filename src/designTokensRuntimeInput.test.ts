import { describe, expect, it } from 'vitest';

import {
  EditorThemeTokenContrastError,
  contrastRatioFromHex,
} from './designTokens.js';

describe('theme contrast runtime input boundary', () => {
  it('rejects non-string colors before caller-controlled coercion', () => {
    const privateSentinel = new Error('private theme color coercion sentinel');
    let coercionCalls = 0;
    const hostileColor = {
      toString(): never {
        coercionCalls += 1;
        throw privateSentinel;
      },
    };

    let observed: unknown;
    try {
      contrastRatioFromHex(hostileColor as unknown as string, '#ffffff');
    } catch (error) {
      observed = error;
    }

    expect(coercionCalls).toBe(0);
    expect(observed).toBeInstanceOf(EditorThemeTokenContrastError);
    expect(observed).not.toBe(privateSentinel);
  });
});
