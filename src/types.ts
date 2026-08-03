import type { Editor } from '@tiptap/react';

/** Which document surface the editor reads from and writes to. */
export type EditorMode = 'markdown' | 'html';

/** Base writing direction exposed by the editable document surface. */
export type EditorTextDirection = 'ltr' | 'rtl' | 'auto';

/** Native focus transition emitted by an Inkspan editable surface. */
export interface CwlEditorFocusEvent {
  /** Stable TipTap editor instance that received or lost focus. */
  editor: Editor;
  /** Native DOM focus event emitted by the ProseMirror editable region. */
  event: FocusEvent;
}

/** Native form reset observed through Inkspan's associated hidden field. */
export interface CwlEditorFormResetEvent {
  /** Stable TipTap editor instance associated with the reset form. */
  editor: Editor;
  /** Native cancelable reset event emitted by the associated form. */
  event: Event;
}

/** Configuration for inline base64 image handling. Config comes from props/KV. */
export interface ImageConfig {
  /** Max source size in bytes before an image is rejected. Default 10 MB. */
  maxSizeBytes?: number;
  /** Downscale so neither dimension exceeds this (px). Default 1600. 0 = off. */
  maxDimension?: number;
  /** Re-encode quality (0..1) used when downscaling. Default 0.85. */
  quality?: number;
}

/**
 * Imperative handle for host apps that need programmatic control (form submit,
 * focus management, AI insert, email send). Prefer this over scraping the DOM.
 */
export interface CwlEditorHandle {
  /** Underlying TipTap editor instance, or `null` before mount / after destroy. */
  getEditor(): Editor | null;
  /** Focus the editable surface. */
  focus(): void;
  /** Blur the editable surface. */
  blur(): void;
  /** Serialized document in the active `mode` (`markdown` or `html`). */
  getValue(): string;
  /** Always HTML (ProseMirror document dump). */
  getHTML(): string;
  /** Always Markdown (HTML → Markdown via the shipped serializer). */
  getMarkdown(): string;
  /** Replace the whole document from a string in the active `mode`. */
  setValue(value: string): void;
  /**
   * Insert content **at the current selection/cursor** without wiping the doc.
   * `value` is interpreted in the active `mode` (Markdown is converted to HTML
   * for insertion). Fires `onChange` — the commercial AI-insert / snippet path.
   */
  insertValue(value: string): void;
  /** Empty the document. */
  clear(): void;
  /** `true` when the document has no meaningful content. */
  isEmpty(): boolean;
}

/** Props for the {@link CwlEditor} React component. */
export interface CwlEditorProps {
  /**
   * Which serialization the `value`/`onChange` strings use.
   * `'markdown'` round-trips CommonMark+GFM; `'html'` round-trips HTML.
   */
  mode?: EditorMode;
  /** Controlled document value in the active `mode`'s format. */
  value?: string;
  /** Uncontrolled initial document value. */
  defaultValue?: string;
  /** Fired on every change with the serialized document in `mode`'s format. */
  onChange?: (value: string) => void;
  /** Fired when the editable ProseMirror region receives focus. */
  onFocus?: (focusEvent: CwlEditorFocusEvent) => void;
  /**
   * Fired when the editable ProseMirror region loses focus. Hosts can use this
   * to mark a field touched or schedule persistence without inspecting the DOM.
   */
  onBlur?: (focusEvent: CwlEditorFocusEvent) => void;
  /**
   * Fired when an image **paste, drop, or toolbar upload** fails (size guard,
   * decode error, etc.). Wired through both the toolbar file picker and the
   * Base64Image ProseMirror plugin so host apps can toast without the editor
   * silently swallowing failures on the commercial path.
   */
  onImageError?: (error: unknown) => void;
  /** Placeholder shown when the document is empty. */
  placeholder?: string;
  /** Render read-only (no editing, no toolbar actions). */
  editable?: boolean;
  /** Hide the toolbar entirely. */
  hideToolbar?: boolean;
  /** Inline base64 image behaviour. */
  image?: ImageConfig;
  /** Extra class name applied to the editor root. */
  className?: string;
  /** Escape hatch: receive the underlying TipTap editor instance. */
  onReady?: (editor: Editor) => void;
  /**
   * Native form field name. When supplied, Inkspan renders a hidden input whose
   * live value is the current document serialized in `mode`.
   */
  formFieldName?: string;
  /**
   * ID of an external form to associate with the hidden serialization field.
   * Omit this when the editor is already rendered inside the target form.
   */
  formId?: string;
  /** Exclude the hidden serialization field from native form submission. */
  formFieldDisabled?: boolean;
  /**
   * Serialized document to apply after a non-canceled native form reset.
   * Omit this to leave document mutation entirely to `onFormReset` or the host.
   */
  formResetValue?: string;
  /**
   * Fired after an associated native form reset is allowed to proceed. The
   * callback runs after `formResetValue`, when configured, has been applied.
   */
  onFormReset?: (resetEvent: CwlEditorFormResetEvent) => void;
  /**
   * BCP 47 language tag for the authored document, such as `ko`, `en-US`, or
   * `ar-EG`. Blank values are omitted from the editable surface.
   */
  languageTag?: string;
  /** Base writing direction for the authored document. */
  textDirection?: EditorTextDirection;
  /**
   * String accessible name for the editable region. Ignored when
   * `ariaLabelledBy` references a visible label.
   */
  ariaLabel?: string;
  /** Space-separated element IDs that visibly label the editable region. */
  ariaLabelledBy?: string;
  /** Space-separated element IDs that describe instructions or constraints. */
  ariaDescribedBy?: string;
  /** ID of the element containing the current validation error message. */
  ariaErrorMessage?: string;
  /** Current validation state exposed through `aria-invalid`. */
  ariaInvalid?: boolean | 'grammar' | 'spelling';
  /** Whether the host form requires editor input before submission. */
  ariaRequired?: boolean;
}
