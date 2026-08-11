import { describe, expect, it } from 'vitest';
import { buildEditorAccessibilityAttributes } from './editorAccessibility.js';

describe('editor accessibility runtime contracts', () => {
  it.each(['ltr', 'rtl', 'auto'] as const)(
    'preserves the valid %s text direction',
    (textDirection) => {
      expect(
        buildEditorAccessibilityAttributes({
          defaultLabel: 'Editor',
          editable: true,
          textDirection,
        }).dir,
      ).toBe(textDirection);
    },
  );

  it('rejects a runtime text direction outside the public enumerated states', () => {
    expect(() =>
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Editor',
        editable: true,
        textDirection: 'sideways' as never,
      }),
    ).toThrowError(
      new RangeError('Editor text direction must be ltr, rtl, or auto.'),
    );
  });

  it.each([false, true, 'grammar', 'spelling'] as const)(
    'preserves the valid %s aria-invalid state',
    (ariaInvalid) => {
      expect(
        buildEditorAccessibilityAttributes({
          defaultLabel: 'Editor',
          editable: true,
          ariaInvalid,
        })['aria-invalid'],
      ).toBe(String(ariaInvalid));
    },
  );

  it('rejects a runtime aria-invalid value outside the public states', () => {
    expect(() =>
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Editor',
        editable: true,
        ariaInvalid: 'unknown' as never,
      }),
    ).toThrowError(
      new RangeError(
        'Editor aria-invalid must be false, true, grammar, or spelling.',
      ),
    );
  });

  it.each([false, true] as const)(
    'preserves the valid %s aria-required state',
    (ariaRequired) => {
      expect(
        buildEditorAccessibilityAttributes({
          defaultLabel: 'Editor',
          editable: true,
          ariaRequired,
        })['aria-required'],
      ).toBe(String(ariaRequired));
    },
  );

  it('rejects a runtime aria-required value outside the public states', () => {
    expect(() =>
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Editor',
        editable: true,
        ariaRequired: 'maybe' as never,
      }),
    ).toThrowError(
      new RangeError('Editor aria-required must be false or true.'),
    );
  });
});
