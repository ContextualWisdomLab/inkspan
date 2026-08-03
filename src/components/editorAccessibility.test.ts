import { describe, expect, it } from 'vitest';
import { buildEditorAccessibilityAttributes } from './editorAccessibility.js';

describe('buildEditorAccessibilityAttributes', () => {
  it('provides a named editable multiline textbox by default', () => {
    expect(
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Rich text editor',
        editable: true,
      }),
    ).toEqual({
      class: 'cwl-editor__content',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-readonly': 'false',
      'aria-label': 'Rich text editor',
    });
  });

  it('prefers a visible label and exposes complete validation metadata', () => {
    expect(
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Fallback',
        ariaLabel: 'Ignored string label',
        ariaLabelledBy: ' compose-title compose-context ',
        ariaDescribedBy: ' compose-help ',
        ariaErrorMessage: ' compose-error ',
        ariaInvalid: 'grammar',
        ariaRequired: true,
        editable: false,
      }),
    ).toEqual({
      class: 'cwl-editor__content',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-readonly': 'true',
      'aria-labelledby': 'compose-title compose-context',
      'aria-describedby': 'compose-help',
      'aria-errormessage': 'compose-error',
      'aria-invalid': 'grammar',
      'aria-required': 'true',
    });
  });

  it('omits blank relationships while retaining explicit false states', () => {
    expect(
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Fallback',
        ariaLabel: 'Draft body',
        ariaLabelledBy: '   ',
        ariaDescribedBy: '',
        ariaErrorMessage: ' ',
        ariaInvalid: false,
        ariaRequired: false,
        editable: true,
      }),
    ).toEqual({
      class: 'cwl-editor__content',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-readonly': 'false',
      'aria-label': 'Draft body',
      'aria-invalid': 'false',
      'aria-required': 'false',
    });
  });

  it('falls back to the default name when a string label is blank', () => {
    expect(
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Rich text editor',
        ariaLabel: '   ',
        editable: true,
      })['aria-label'],
    ).toBe('Rich text editor');
  });

  it('preserves the spelling validation state', () => {
    expect(
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Editor',
        ariaInvalid: 'spelling',
        editable: true,
      })['aria-invalid'],
    ).toBe('spelling');
  });
});
