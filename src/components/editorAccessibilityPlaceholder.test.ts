import { describe, expect, it } from 'vitest';
import { buildEditorAccessibilityAttributes } from './editorAccessibility.js';

describe('editor accessible placeholder contract', () => {
  it('exposes normalized placeholder guidance without replacing the accessible name', () => {
    expect(
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Rich text editor',
        ariaLabelledBy: 'editor-label',
        placeholder: '  Start writing…  ',
        editable: true,
      }),
    ).toEqual({
      class: 'cwl-editor__content',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-readonly': 'false',
      'aria-labelledby': 'editor-label',
      'aria-placeholder': 'Start writing…',
    });
  });
});
