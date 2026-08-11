import type { EditorTextDirection } from '../types.js';

const ACCESSIBILITY_METADATA_MAX_CODE_UNITS = 65_536;
const INVALID_ACCESSIBILITY_METADATA_MESSAGE =
  'Accessibility metadata must be a string within the supported length.';
const INVALID_LANGUAGE_TAG_MESSAGE =
  'Accessibility language tag must be valid BCP 47 metadata.';

/** Values accepted by the WAI-ARIA `aria-invalid` state on a textbox. */
export type EditorAriaInvalid = boolean | 'grammar' | 'spelling';

/** Host-supplied accessibility metadata for an Inkspan editable surface. */
export interface EditorAccessibilityOptions {
  /** Fallback accessible name when no host label reference is supplied. */
  defaultLabel: string;
  /** Visual empty-editor guidance mirrored to `aria-placeholder` when non-blank. */
  placeholder?: string;
  /** BCP 47 language tag for the authored document. */
  languageTag?: string;
  /** Base writing direction for the authored document. */
  textDirection?: EditorTextDirection;
  /** Explicit string accessible name for the editable surface. */
  ariaLabel?: string;
  /** Space-separated IDs of elements that label the surface. */
  ariaLabelledBy?: string;
  /** Space-separated IDs of elements that describe the surface. */
  ariaDescribedBy?: string;
  /** ID of the element that contains the current validation error. */
  ariaErrorMessage?: string;
  /** Whether the current editor value is invalid. */
  ariaInvalid?: EditorAriaInvalid;
  /** Whether the host requires a value before form submission. */
  ariaRequired?: boolean;
  /** Whether the document can currently be edited. */
  editable: boolean;
}

/** Normalize optional host metadata after enforcing Inkspan's local size boundary. */
function normalizedAccessibilityValue(
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    value.length > ACCESSIBILITY_METADATA_MAX_CODE_UNITS
  ) {
    throw new RangeError(INVALID_ACCESSIBILITY_METADATA_MESSAGE);
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

/** Validate one non-blank editor language tag without changing caller spelling. */
function normalizedEditorLanguageTag(
  value: string | undefined,
): string | undefined {
  const normalized = normalizedAccessibilityValue(value);
  if (normalized === undefined) return undefined;
  try {
    Intl.getCanonicalLocales(normalized);
  } catch {
    throw new RangeError(INVALID_LANGUAGE_TAG_MESSAGE);
  }
  return normalized;
}

/**
 * Normalize the shared visual and semantic empty-editor guidance.
 *
 * Returning `undefined` for blank input lets callers omit both the visual
 * Placeholder extension text and `aria-placeholder` from the same source.
 */
export function normalizeEditorPlaceholder(
  value: string | undefined,
): string | undefined {
  return normalizedAccessibilityValue(value);
}

/**
 * Build the complete semantic attribute contract shared by standalone and
 * collaborative editor surfaces.
 *
 * A non-blank `aria-labelledby` reference takes precedence over the fallback
 * string label. Optional placeholder, language, and ID-reference values are
 * omitted when blank. Non-blank language metadata must be a syntactically valid
 * BCP 47 tag, while its trimmed caller spelling is preserved. Placeholder
 * guidance remains supplemental and never replaces the accessible name.
 */
export function buildEditorAccessibilityAttributes(
  options: EditorAccessibilityOptions,
): Record<string, string> {
  const placeholder = normalizeEditorPlaceholder(options.placeholder);
  const languageTag = normalizedEditorLanguageTag(options.languageTag);
  const labelledBy = normalizedAccessibilityValue(options.ariaLabelledBy);
  const describedBy = normalizedAccessibilityValue(options.ariaDescribedBy);
  const errorMessage = normalizedAccessibilityValue(options.ariaErrorMessage);
  const explicitLabel = normalizedAccessibilityValue(options.ariaLabel);
  const attributes: Record<string, string> = {
    class: 'cwl-editor__content',
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-readonly': String(!options.editable),
  };

  if (placeholder) attributes['aria-placeholder'] = placeholder;
  if (languageTag) attributes.lang = languageTag;
  if (options.textDirection) attributes.dir = options.textDirection;
  if (labelledBy) {
    attributes['aria-labelledby'] = labelledBy;
  } else {
    attributes['aria-label'] = explicitLabel ?? options.defaultLabel;
  }
  if (describedBy) attributes['aria-describedby'] = describedBy;
  if (errorMessage) attributes['aria-errormessage'] = errorMessage;
  if (options.ariaInvalid !== undefined) {
    attributes['aria-invalid'] = String(options.ariaInvalid);
  }
  if (options.ariaRequired !== undefined) {
    attributes['aria-required'] = String(options.ariaRequired);
  }

  return attributes;
}
