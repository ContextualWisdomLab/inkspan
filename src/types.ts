import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';

/** Which document surface the editor reads from and writes to. */
export type EditorMode = 'markdown' | 'html';

/** Base writing direction exposed by the editable document surface. */
export type EditorTextDirection = 'ltr' | 'rtl' | 'auto';

/** Detached, portable representations of one current editor revision. */
export interface CwlEditorDocumentSnapshot {
  /** Serialization selected by the host for `value` and `onChange`. */
  readonly mode: EditorMode;
  /** Current document serialized in the active `mode`. */
  readonly value: string;
  /** Current ProseMirror document serialized as HTML. */
  readonly html: string;
  /** Current document serialized as normalized Markdown. */
  readonly markdown: string;
  /** Destination-free deterministic reading-order projection. */
  readonly plainText: string;
  /**
   * Deep-frozen TipTap/ProseMirror JSON for lossless structural persistence.
   * `null` is returned before the editor instance has been created.
   */
  readonly documentJson: Readonly<JSONContent> | null;
  /** Whether the current editor document has no meaningful content. */
  readonly isEmpty: boolean;
}

/** Document-changing update emitted by an Inkspan editable surface. */
export interface CwlEditorDocumentChangeEvent {
  /** Stable TipTap editor instance whose document changed. */
  editor: Editor;
  /** Frozen detached representations of the same current document revision. */
  snapshot: CwlEditorDocumentSnapshot;
}

/** Native focus transition emitted by an Inkspan editable surface. */
export interface CwlEditorFocusEvent {
  /** Stable TipTap editor instance that received or lost focus. */
  editor: Editor;
  /** Native DOM focus event emitted by the ProseMirror editable region. */
  event: FocusEvent;
}

/** Detached snapshot of the current ProseMirror document selection. */
export interface CwlEditorSelectionSnapshot {
  /** Fixed side of the selection in the current ProseMirror document. */
  readonly anchor: number;
  /** Moving side of the selection in the current ProseMirror document. */
  readonly head: number;
  /** Lower document-position bound of the selection. */
  readonly from: number;
  /** Upper document-position bound of the selection. */
  readonly to: number;
  /** Whether the selection is a caret rather than a range. */
  readonly empty: boolean;
}

/** Local selection transition emitted by an Inkspan editable surface. */
export interface CwlEditorSelectionEvent {
  /** Stable TipTap editor instance whose local selection changed. */
  editor: Editor;
  /** Detached position snapshot valid for the editor's current document state. */
  selection: CwlEditorSelectionSnapshot;
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
  /**
   * Frozen active-mode, HTML, Markdown, plain-text, and structural JSON
   * representations from one current editor revision.
   */
  getSnapshot(): CwlEditorDocumentSnapshot;
  /** Replace the whole document from a string in the active `mode`. */
  setValue(value: string): void;
  /**
   * Check whether JSON can be restored by the active TipTap/ProseMirror schema
   * without mutating the document. Returns `false` before editor creation.
   */
  validateDocumentJson(documentJson: JSONContent): boolean;
  /**
   * Replace the whole document from TipTap/ProseMirror JSON without an
   * HTML/Markdown conversion round-trip. The complete node tree is validated
   * before mutation. This mirrors `setValue` and does not emit `onChange`.
   */
  setDocumentJson(documentJson: JSONContent): void;
  /**
   * Insert content **at the current selection/cursor** without wiping the doc.
   * `value` is interpreted in the active `mode` (Markdown is converted to HTML
   * for insertion). Fires `onChange` — the commercial AI-insert / snippet path.
   */
  insertValue(value: string): void;
  /**
   * Check whether one or more JSON nodes match the active schema without
   * changing the document or local selection. Returns `false` before creation.
   */
  validateDocumentInsertionJson(
    documentJson: JSONContent | JSONContent[],
  ): boolean;
  /**
   * Insert one or more TipTap/ProseMirror JSON nodes at the current selection.
   * The complete fragment is detached and schema-checked before one transaction
   * is dispatched. Fires the normal document-change callbacks and applies the
   * same safe-link and inline-image transaction boundaries as other writes.
   */
  insertDocumentJson(documentJson: JSONContent | JSONContent[]): void;
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
  /**
   * Fired on every document-changing update with one detached, frozen snapshot.
   * Replacing this callback does not recreate the TipTap editor or Yjs binding.
   */
  onDocumentChange?: (
    changeEvent: CwlEditorDocumentChangeEvent,
  ) => void;
  /** Fired when the editable ProseMirror region receives focus. */
  onFocus?: (focusEvent: CwlEditorFocusEvent) => void;
  /**
   * Fired when the editable ProseMirror region loses focus. Hosts can use this
   * to mark a field touched or schedule persistence without inspecting the DOM.
   */
  onBlur?: (focusEvent: CwlEditorFocusEvent) => void;
  /**
   * Fired when the local ProseMirror selection changes. Position snapshots are
   * ephemeral document coordinates, not DOM offsets or durable identifiers.
   */
  onSelectionChange?: (selectionEvent: CwlEditorSelectionEvent) => void;
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
  /**
   * Fired once for each TipTap editor instance after creation. Replacing this
   * callback does not replay readiness for an already-created instance.
   */
  onReady?: (editor: Editor) => void;
  /**
   * Fired once for each TipTap editor instance when it is destroyed. The latest
   * callback is used so hosts can safely attach or replace teardown logic.
   */
  onDestroy?: (editor: Editor) => void;
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
