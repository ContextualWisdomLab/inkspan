import type { Editor } from '@tiptap/react';
import {
  useImperativeHandle,
  type ForwardedRef,
  type MutableRefObject,
} from 'react';
import {
  parseDocumentInsertionJsonForEditor,
  parseDocumentJsonForEditor,
  validateDocumentInsertionJson,
  validateDocumentJson,
} from '../documentSchema.js';
import type { CwlEditorHandle, EditorMode } from '../types.js';
import { createEditorDocumentSnapshot } from './editorDocumentSnapshot.js';
import { editorHtmlToValue, editorValueToHtml } from './editorSerialization.js';

/** Expose the stable host-control contract shared by editor surfaces. */
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
      getSnapshot: () =>
        createEditorDocumentSnapshot(editor, modeRef.current),
      setValue: (next: string) => {
        if (!editor) return;
        editor.commands.setContent(
          editorValueToHtml(next, modeRef.current),
          false,
        );
      },
      validateDocumentJson: (documentJson) =>
        editor ? validateDocumentJson(editor, documentJson) : false,
      setDocumentJson: (documentJson) => {
        if (!editor) return;
        const documentNode = parseDocumentJsonForEditor(editor, documentJson);
        editor.commands.setContent(documentNode, false);
      },
      insertValue: (next: string) => {
        if (!editor) return;
        editor
          .chain()
          .focus()
          .insertContent(editorValueToHtml(next, modeRef.current))
          .run();
      },
      validateDocumentInsertionJson: (documentJson) =>
        editor ? validateDocumentInsertionJson(editor, documentJson) : false,
      insertDocumentJson: (documentJson) => {
        if (!editor) return;
        const documentFragment = parseDocumentInsertionJsonForEditor(
          editor,
          documentJson,
        );
        editor.chain().focus().insertContent(documentFragment).run();
      },
      clear: () => {
        editor?.commands.clearContent(true);
      },
      isEmpty: () => editor?.isEmpty ?? true,
    }),
    [editor, modeRef],
  );
}
