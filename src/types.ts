import type { Editor } from '@tiptap/react';

/** Which document surface the editor reads from and writes to. */
export type EditorMode = 'markdown' | 'html';

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
  /** ARIA label for the editable region. */
  ariaLabel?: string;
}
