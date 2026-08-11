import { describe, expect, it } from 'vitest';
import { buildEditorAccessibilityAttributes } from './editorAccessibility.js';

describe('editor accessibility runtime contracts', () => {
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
});
