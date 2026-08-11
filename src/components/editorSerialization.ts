import type { EditorMode } from '../types.js';
import {
  htmlToMarkdown,
  markdownToEditorHtml,
} from '../markdown/serializer.js';

const INVALID_MODE_ERROR = 'Editor mode must be markdown or html.';

function assertEditorMode(mode: EditorMode): void {
  if (mode !== 'markdown' && mode !== 'html') {
    throw new RangeError(INVALID_MODE_ERROR);
  }
}

/** Convert a host value in the selected editor mode into TipTap HTML. */
export function editorValueToHtml(value: string, mode: EditorMode): string {
  assertEditorMode(mode);
  return mode === 'markdown' ? markdownToEditorHtml(value) : value;
}

/** Convert TipTap HTML into the serialization selected by the host. */
export function editorHtmlToValue(html: string, mode: EditorMode): string {
  assertEditorMode(mode);
  return mode === 'markdown' ? htmlToMarkdown(html) : html;
}
