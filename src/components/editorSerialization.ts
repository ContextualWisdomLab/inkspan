import type { EditorMode } from '../types.js';
import { htmlToMarkdown } from '../markdown/serializer.js';
import { markdownToEditorHtml } from '../markdown/resourceBoundMarkdown.js';

/** Convert a host value in the selected editor mode into TipTap HTML. */
export function editorValueToHtml(value: string, mode: EditorMode): string {
  return mode === 'markdown' ? markdownToEditorHtml(value) : value;
}

/** Convert TipTap HTML into the serialization selected by the host. */
export function editorHtmlToValue(html: string, mode: EditorMode): string {
  return mode === 'markdown' ? htmlToMarkdown(html) : html;
}
