import { describe, expect, it } from 'vitest';
import { contrastingTextColor } from './awareness.js';

const INVALID_CONTRAST_COLOR_ERROR = new RangeError(
  'collaboration contrast color must be a six-digit hexadecimal color',
);

describe('public collaboration contrast-color contract', () => {
  it.each(['#fff', '#zzzzzz', 'red', ''])(
    'rejects malformed color token %j instead of returning a plausible contrast',
    (color) => {
      expect(() => contrastingTextColor(color)).toThrowError(
        INVALID_CONTRAST_COLOR_ERROR,
      );
    },
  );

  it('rejects non-string runtime input without coercion', () => {
    expect(() => contrastingTextColor(7 as never)).toThrowError(
      INVALID_CONTRAST_COLOR_ERROR,
    );
  });

  it('preserves valid uppercase and lowercase six-digit colors', () => {
    expect(contrastingTextColor('#FFFFFF')).toBe('#000000');
    expect(contrastingTextColor('#000000')).toBe('#ffffff');
    expect(contrastingTextColor('#777777')).toBe('#000000');
  });
});
