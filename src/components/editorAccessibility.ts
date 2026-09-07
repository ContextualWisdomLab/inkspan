import type { EditorTextDirection } from '../types.js';

const ACCESSIBILITY_METADATA_MAX_CODE_UNITS = 65_536;
const INVALID_ACCESSIBILITY_METADATA_MESSAGE =
  'Accessibility metadata must be a string within the supported length.';
const INVALID_LANGUAGE_TAG_MESSAGE =
  'Accessibility language tag must be valid BCP 47 metadata.';

const RFC_5646_GRANDFATHERED_TAGS = new Set([
  'art-lojban',
  'cel-gaulish',
  'en-gb-oed',
  'i-ami',
  'i-bnn',
  'i-default',
  'i-enochian',
  'i-hak',
  'i-klingon',
  'i-lux',
  'i-mingo',
  'i-navajo',
  'i-pwn',
  'i-tao',
  'i-tay',
  'i-tsu',
  'no-bok',
  'no-nyn',
  'sgn-be-fr',
  'sgn-be-nl',
  'sgn-ch-de',
  'zh-guoyu',
  'zh-hakka',
  'zh-min',
  'zh-min-nan',
  'zh-xiang',
]);
const RFC_5646_PRIVATE_USE_TAG = /^[xX](?:-[A-Za-z0-9]{1,8})+$/;
const RFC_5646_LANGTAG = /^(?:[A-Za-z]{2,3}(?:-[A-Za-z]{3})?|[A-Za-z]{4}|[A-Za-z]{5,8})(?:-[A-Za-z]{4})?(?:-(?:[A-Za-z]{2}|[0-9]{3}))?(?:-(?:[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(?:-[0-9A-WY-Za-wy-z](?:-[A-Za-z0-9]{2,8})+)*(?:-[xX](?:-[A-Za-z0-9]{1,8})+)?$/;
const RFC_5646_VARIANT = /^(?:[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3})$/;
const RFC_5646_EXTENSION_SINGLETON = /^[0-9A-WY-Za-wy-z]$/;

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

/** Enforce Inkspan's local type and resource boundary for accessibility text. */
function validatedAccessibilityValue(value: string): string {
  if (
    typeof value !== 'string' ||
    value.length > ACCESSIBILITY_METADATA_MAX_CODE_UNITS
  ) {
    throw new RangeError(INVALID_ACCESSIBILITY_METADATA_MESSAGE);
  }
  return value;
}

/** Normalize optional host metadata after enforcing Inkspan's local size boundary. */
function normalizedAccessibilityValue(
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;

  const normalized = validatedAccessibilityValue(value).trim();
  return normalized ? normalized : undefined;
}

/** Enforce RFC 5646's locally decidable uniqueness rules beyond its ABNF shape. */
function hasUniqueLanguageTagSubtags(value: string): boolean {
  const variants = new Set<string>();
  const extensionSingletons = new Set<string>();
  let readingExtensions = false;

  for (const subtag of value.split('-').slice(1)) {
    const normalized = subtag.toLowerCase();
    if (normalized === 'x') break;

    if (RFC_5646_EXTENSION_SINGLETON.test(subtag)) {
      if (extensionSingletons.has(normalized)) return false;
      extensionSingletons.add(normalized);
      readingExtensions = true;
      continue;
    }

    if (!readingExtensions && RFC_5646_VARIANT.test(subtag)) {
      if (variants.has(normalized)) return false;
      variants.add(normalized);
    }
  }

  return true;
}

/** Check locally decidable RFC 5646 validity without IANA registry lookup. */
function isWellFormedLanguageTag(value: string): boolean {
  return (
    RFC_5646_GRANDFATHERED_TAGS.has(value.toLowerCase()) ||
    RFC_5646_PRIVATE_USE_TAG.test(value) ||
    (RFC_5646_LANGTAG.test(value) && hasUniqueLanguageTagSubtags(value))
  );
}

/** Validate one non-blank editor language tag without changing caller spelling. */
function normalizedEditorLanguageTag(
  value: string | undefined,
): string | undefined {
  const normalized = normalizedAccessibilityValue(value);
  if (normalized === undefined) return undefined;
  if (!isWellFormedLanguageTag(normalized)) {
    throw new RangeError(INVALID_LANGUAGE_TAG_MESSAGE);
  }
  return normalized;
}

/** Reject runtime direction values outside Inkspan's public finite contract. */
function validateEditorTextDirection(
  value: EditorTextDirection | undefined,
): void {
  if (
    value !== undefined &&
    value !== 'ltr' &&
    value !== 'rtl' &&
    value !== 'auto'
  ) {
    throw new RangeError('Editor text direction must be ltr, rtl, or auto.');
  }
}

/** Reject runtime `aria-invalid` values outside Inkspan's finite contract. */
function validateEditorAriaInvalid(
  value: EditorAriaInvalid | undefined,
): void {
  if (
    value !== undefined &&
    value !== false &&
    value !== true &&
    value !== 'grammar' &&
    value !== 'spelling'
  ) {
    throw new RangeError(
      'Editor aria-invalid must be false, true, grammar, or spelling.',
    );
  }
}

/** Reject runtime `aria-required` values outside Inkspan's boolean contract. */
function validateEditorAriaRequired(value: boolean | undefined): void {
  if (value !== undefined && value !== false && value !== true) {
    throw new RangeError('Editor aria-required must be false or true.');
  }
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
 * string label. Required and optional accessibility strings are bounded before
 * attribute emission; optional placeholder, language, and ID-reference values
 * are omitted when blank. Non-blank language metadata must satisfy RFC 5646 rules
 * that Inkspan can decide locally, including private-use, grandfathered,
 * extlang-position, variant-uniqueness, and extension-uniqueness constraints;
 * IANA registry-content validity remains a host policy concern. Runtime direction
 * and ARIA state values are each captured once and checked against Inkspan's finite
 * public contracts before the same captured value is emitted. The trimmed caller
 * spelling of accepted language tags is preserved. Placeholder guidance remains
 * supplemental and never replaces the accessible name.
 */
export function buildEditorAccessibilityAttributes(
  options: EditorAccessibilityOptions,
): Record<string, string> {
  const textDirection = options.textDirection;
  const ariaInvalid = options.ariaInvalid;
  const ariaRequired = options.ariaRequired;

  validateEditorTextDirection(textDirection);
  validateEditorAriaInvalid(ariaInvalid);
  validateEditorAriaRequired(ariaRequired);

  const defaultLabel = validatedAccessibilityValue(options.defaultLabel);
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
  if (textDirection) attributes.dir = textDirection;
  if (labelledBy) {
    attributes['aria-labelledby'] = labelledBy;
  } else {
    attributes['aria-label'] = explicitLabel ?? defaultLabel;
  }
  if (describedBy) attributes['aria-describedby'] = describedBy;
  if (errorMessage) attributes['aria-errormessage'] = errorMessage;
  if (ariaInvalid !== undefined) {
    attributes['aria-invalid'] = String(ariaInvalid);
  }
  if (ariaRequired !== undefined) {
    attributes['aria-required'] = String(ariaRequired);
  }

  return attributes;
}
