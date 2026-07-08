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
