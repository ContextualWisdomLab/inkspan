import { describe, expect, it } from 'vitest';
import {
  buildEditorAccessibilityAttributes,
  type EditorAccessibilityOptions,
} from './editorAccessibility.js';

const ACCESSIBILITY_METADATA_MAX_CODE_UNITS = 65_536;
const INVALID_ACCESSIBILITY_METADATA_MESSAGE =
  'Accessibility metadata must be a string within the supported length.';

function attributesWithAriaLabel(value: unknown): Record<string, string> {
  return buildEditorAccessibilityAttributes({
    defaultLabel: 'Editor',
    editable: true,
    ariaLabel: value as EditorAccessibilityOptions['ariaLabel'],
  });
}

describe('editor accessibility metadata resource boundary', () => {
  it('rejects non-string runtime metadata through one stable error contract', () => {
    expect(() => attributesWithAriaLabel(42)).toThrowError(
      new RangeError(INVALID_ACCESSIBILITY_METADATA_MESSAGE),
    );
  });

  it('rejects oversized metadata without reflecting its payload', () => {
    const privateMarker = 'private-accessibility-marker';
    const value = `${privateMarker}${'x'.repeat(ACCESSIBILITY_METADATA_MAX_CODE_UNITS)}`;
    let failure: unknown;

    try {
      attributesWithAriaLabel(value);
    } catch (error) {
      failure = error;
    }

    expect(failure).toEqual(
      new RangeError(INVALID_ACCESSIBILITY_METADATA_MESSAGE),
    );
    expect(String(failure)).not.toContain(privateMarker);
  });

  it('accepts metadata exactly at the local ceiling', () => {
    const value = 'x'.repeat(ACCESSIBILITY_METADATA_MAX_CODE_UNITS);

    expect(attributesWithAriaLabel(value)['aria-label']).toBe(value);
  });

  it('keeps blank optional metadata omitted after bounded normalization', () => {
    expect(
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Editor',
        editable: true,
        placeholder: '  ',
        languageTag: '  ',
        ariaLabelledBy: '  ',
        ariaDescribedBy: '  ',
        ariaErrorMessage: '  ',
      }),
    ).toEqual({
      class: 'cwl-editor__content',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-readonly': 'false',
      'aria-label': 'Editor',
    });
  });
});
