import type { EditorMode } from '../types.js';
import { htmlToMarkdown, markdownToHtml } from '../markdown/serializer.js';

/** Convert a host value in the selected editor mode into TipTap HTML. */
export function editorValueToHtml(value: string, mode: EditorMode): string {
  return mode === 'markdown' ? markdownToHtml(value) : value;
}

/** Convert TipTap HTML into the serialization selected by the host. */
export function editorHtmlToValue(html: string, mode: EditorMode): string {
  return mode === 'markdown' ? htmlToMarkdown(html) : html;
}
