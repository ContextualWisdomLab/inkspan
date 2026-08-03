import type { Editor } from '@tiptap/react';
import {
  useImperativeHandle,
  type ForwardedRef,
  type MutableRefObject,
} from 'react';
import type {
  CwlEditorHandle,
  EditorMode,
  EditorSelectionSnapshot,
} from '../types.js';
import { editorHtmlToValue, editorValueToHtml } from './editorSerialization.js';

/** Return a privacy-preserving point-in-time selection snapshot. */
function getEditorSelection(editor: Editor | null): EditorSelectionSnapshot {
  if (!editor) {
    return {
      anchor: 0,
      head: 0,
      from: 0,
      to: 0,
      empty: true,
      text: '',
    };
  }

  const { selection, doc } = editor.state;
  return {
    anchor: selection.anchor,
    head: selection.head,
    from: selection.from,
    to: selection.to,
    empty: selection.empty,
    text: selection.empty
      ? ''
      : doc.textBetween(selection.from, selection.to, '\n\n', ''),
  };
}

/**
 * Expose the stable host-control contract shared by standalone and
 * collaborative editor surfaces.
 */
export function useEditorHandle(
  ref: ForwardedRef<CwlEditorHandle>,
  editor: Editor | null,
  modeRef: MutableRefObject<EditorMode>,
): void {
  useImperativeHandle(
    ref,
    (): CwlEditorHandle => ({
      getEditor: () => editor,
      focus: () => {
        editor?.chain().focus().run();
      },
      blur: () => {
        editor?.commands.blur();
      },
      getValue: () => {
        if (!editor) return '';
        return editorHtmlToValue(editor.getHTML(), modeRef.current);
      },
      getHTML: () => editor?.getHTML() ?? '',
      getMarkdown: () => {
        if (!editor) return '';
        return editorHtmlToValue(editor.getHTML(), 'markdown');
      },
      getSelection: () => getEditorSelection(editor),
      setValue: (next: string) => {
        if (!editor) return;
        editor.commands.setContent(
          editorValueToHtml(next, modeRef.current),
          false,
        );
      },
      insertValue: (next: string) => {
        if (!editor) return;
        editor
          .chain()
          .focus()
          .insertContent(editorValueToHtml(next, modeRef.current))
          .run();
      },
      clear: () => {
        editor?.commands.clearContent(true);
      },
      isEmpty: () => editor?.isEmpty ?? true,
    }),
    [editor, modeRef],
  );
}
