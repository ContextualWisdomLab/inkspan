import { describe, expect, it } from 'vitest';
import {
  buildEditorAccessibilityAttributes,
  type EditorAccessibilityOptions,
} from './editorAccessibility.js';

const ACCESSIBILITY_METADATA_MAX_CODE_UNITS = 65_536;
const INVALID_ACCESSIBILITY_METADATA_MESSAGE =
  'Accessibility metadata must be a string within the supported length.';
const INVALID_LANGUAGE_TAG_MESSAGE =
  'Accessibility language tag must be valid BCP 47 metadata.';

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

  it('rejects malformed editor language tags without reflecting the payload', () => {
    const privateMarker = 'private-invalid-language-marker';
    let failure: unknown;

    try {
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Editor',
        editable: true,
        languageTag: `${privateMarker} not-a-tag`,
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toEqual(new RangeError(INVALID_LANGUAGE_TAG_MESSAGE));
    expect(String(failure)).not.toContain(privateMarker);
  });

  it('validates but does not canonicalize accepted language tag spelling', () => {
    expect(
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Editor',
        editable: true,
        languageTag: '  EN-us  ',
      }).lang,
    ).toBe('EN-us');
  });

  it.each([
    'x-private',
    'i-klingon',
    'zh-cmn-Hans-CN',
    'en-US-x-private',
  ])('preserves well-formed RFC 5646 language tag %s', (languageTag) => {
    expect(
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Editor',
        editable: true,
        languageTag: `  ${languageTag}  `,
      }).lang,
    ).toBe(languageTag);
  });

  it.each(['zh-cmn-hak', 'zh-cmn-hak-yue'])(
    'rejects RFC 5646 tag with a permanently invalid extra extlang: %s',
    (languageTag) => {
      expect(() =>
        buildEditorAccessibilityAttributes({
          defaultLabel: 'Editor',
          editable: true,
          languageTag,
        }),
      ).toThrowError(new RangeError(INVALID_LANGUAGE_TAG_MESSAGE));
    },
  );

  it.each(['de-DE-1901-1901', 'en-a-bbb-a-ccc'])(
    'rejects RFC 5646 tag with repeated variant or extension singleton: %s',
    (languageTag) => {
      expect(() =>
        buildEditorAccessibilityAttributes({
          defaultLabel: 'Editor',
          editable: true,
          languageTag,
        }),
      ).toThrowError(new RangeError(INVALID_LANGUAGE_TAG_MESSAGE));
    },
  );
});
