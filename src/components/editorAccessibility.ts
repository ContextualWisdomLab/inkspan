/** Values accepted by the WAI-ARIA `aria-invalid` state on a textbox. */
export type EditorAriaInvalid = boolean | 'grammar' | 'spelling';

/** Host-supplied accessibility metadata for an Inkspan editable surface. */
export interface EditorAccessibilityOptions {
  /** Fallback accessible name when no host label reference is supplied. */
  defaultLabel: string;
  /** Explicit string accessible name for the editable surface. */
  ariaLabel?: string;
  /** Space-separated IDs of visible elements that label the surface. */
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

/** Normalize a host-supplied accessible-name or ID-reference string. */
function normalizedAccessibilityValue(
  value: string | undefined,
): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

/**
 * Build the complete ARIA attribute contract shared by standalone and
 * collaborative editor surfaces.
 *
 * A visible label referenced with `aria-labelledby` takes precedence over the
 * fallback string label. Optional ID references are omitted when blank so
 * assistive technologies never receive broken empty relationships.
 */
export function buildEditorAccessibilityAttributes(
  options: EditorAccessibilityOptions,
): Record<string, string> {
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
