import type { Editor } from '@tiptap/react';
import {
  useImperativeHandle,
  type ForwardedRef,
  type MutableRefObject,
} from 'react';
import {
  createDocumentEnvelope,
  type CwlEditorDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from '../documentEnvelope.js';
import {
  encodeValidatedDocumentEnvelope,
  serializeValidatedDocumentEnvelope,
} from '../documentEnvelopeCanonical.js';
import {
  restoreDocumentEnvelopeBytesIfMatch,
  restoreDocumentEnvelopeIfMatch,
} from '../documentEnvelopeIfMatch.js';
import { createValidatedDocumentEnvelopeRevision } from '../documentEnvelopeRevision.js';
import { createValidatedDocumentEnvelopeRevisionEvidence } from '../documentRevisionEvidence.js';
import {
  restoreDocumentEnvelope,
  restoreDocumentEnvelopeBytes,
  validateDocumentEnvelopeBytesForEditor,
  validateDocumentEnvelopeForEditor,
} from '../documentEnvelopeRestore.js';
import {
  parseDocumentJsonForEditor,
  validateDocumentJson,
} from '../documentSchema.js';
import { createTextPositionSelector } from '../textPositionSelectorEvidence.js';
import type { CwlEditorHandle, EditorMode } from '../types.js';
import { createEditorDocumentSnapshot } from './editorDocumentSnapshot.js';
import { editorHtmlToValue, editorValueToHtml } from './editorSerialization.js';

/** Create a validated portable envelope from one active editor revision. */
function createCurrentDocumentEnvelope(
  editor: Editor,
  limits?: DocumentEnvelopeLimits,
): CwlEditorDocumentEnvelope {
  return createDocumentEnvelope(editor.getJSON(), limits);
}

/** Return the current usable editor instance, if one still exists. */
function activeEditor(editor: Editor | null): Editor | null {
  return editor && !editor.isDestroyed ? editor : null;
}

/** Expose the stable host-control contract shared by editor surfaces. */
export function useEditorHandle(
  ref: ForwardedRef<CwlEditorHandle>,
  editor: Editor | null,
  modeRef: MutableRefObject<EditorMode>,
): void {
  useImperativeHandle(
    ref,
    (): CwlEditorHandle => ({
      getEditor: () => activeEditor(editor),
      focus: () => {
        activeEditor(editor)?.chain().focus().run();
      },
      blur: () => {
        activeEditor(editor)?.commands.blur();
      },
      canUndo: () => activeEditor(editor)?.can().undo() ?? false,
      undo: () => activeEditor(editor)?.chain().focus().undo().run() ?? false,
      canRedo: () => activeEditor(editor)?.can().redo() ?? false,
      redo: () => activeEditor(editor)?.chain().focus().redo().run() ?? false,
      getValue: () => {
        const current = activeEditor(editor);
        if (!current) return '';
        return editorHtmlToValue(current.getHTML(), modeRef.current);
      },
      getHTML: () => activeEditor(editor)?.getHTML() ?? '',
      getMarkdown: () => {
        const current = activeEditor(editor);
        if (!current) return '';
        return editorHtmlToValue(current.getHTML(), 'markdown');
      },
      getSnapshot: () =>
        createEditorDocumentSnapshot(activeEditor(editor), modeRef.current),
      getDocumentEnvelope: (limits) => {
        const current = activeEditor(editor);
        return current ? createCurrentDocumentEnvelope(current, limits) : null;
      },
      getDocumentEnvelopeJson: (limits) => {
        const current = activeEditor(editor);
        return current
          ? serializeValidatedDocumentEnvelope(
              createCurrentDocumentEnvelope(current, limits),
            )
          : '';
      },
      getDocumentEnvelopeBytes: (limits) => {
        const current = activeEditor(editor);
        return current
          ? encodeValidatedDocumentEnvelope(
              createCurrentDocumentEnvelope(current, limits),
            )
          : new Uint8Array();
      },
      getDocumentEnvelopeRevision: (limits, digestProvider) =>
        editor
          ? createValidatedDocumentEnvelopeRevision(
              createCurrentDocumentEnvelope(editor, limits),
              digestProvider,
            )
          : Promise.resolve(null),
      getDocumentEnvelopeRevisionEvidence: (limits, digestProvider) =>
        editor
          ? createValidatedDocumentEnvelopeRevisionEvidence(
              createCurrentDocumentEnvelope(editor, limits),
              digestProvider,
            )
          : Promise.resolve(null),
      getSelectionRevisionEvidence: async (limits, digestProvider) => {
        if (!editor) return null;
        const state = editor.state;
        const selection = Object.freeze({
          anchor: state.selection.anchor,
          head: state.selection.head,
          from: state.selection.from,
          to: state.selection.to,
          empty: state.selection.empty,
        });
        const envelope = createDocumentEnvelope(state.doc.toJSON(), limits);
        const revision = await createValidatedDocumentEnvelopeRevision(
          envelope,
          digestProvider,
        );
        return Object.freeze({ revision, selection });
      },
      getTextPositionSelectorEvidence: async (limits, digestProvider) => {
        if (!editor) return null;
        const state = editor.state;
        const { selector, textProjection } = createTextPositionSelector(
          state.doc,
          state.selection,
        );
        const envelope = createDocumentEnvelope(state.doc.toJSON(), limits);
        const revision = await createValidatedDocumentEnvelopeRevision(
          envelope,
          digestProvider,
        );
        return Object.freeze({ revision, selector, textProjection });
      },
      setValue: (next: string) => {
        const current = activeEditor(editor);
        if (!current) return;
        current.commands.setContent(
          editorValueToHtml(next, modeRef.current),
          false,
        );
      },
      validateDocumentEnvelope: (source, limits) => {
        const current = activeEditor(editor);
        return current
          ? validateDocumentEnvelopeForEditor(current, source, limits)
          : false;
      },
      validateDocumentEnvelopeBytes: (source, limits) => {
        const current = activeEditor(editor);
        return current
          ? validateDocumentEnvelopeBytesForEditor(current, source, limits)
          : false;
      },
      restoreDocumentEnvelope: (source, limits) =>
        editor ? restoreDocumentEnvelope(editor, source, limits) : null,
      restoreDocumentEnvelopeBytes: (source, limits) =>
        editor ? restoreDocumentEnvelopeBytes(editor, source, limits) : null,
      restoreDocumentEnvelopeIfMatch: (
        expectedStrongEntityTag,
        source,
        limits,
        digestProvider,
      ) =>
        editor
          ? restoreDocumentEnvelopeIfMatch(
              editor,
              expectedStrongEntityTag,
              source,
              limits,
              digestProvider,
            )
          : Promise.resolve(null),
      restoreDocumentEnvelopeBytesIfMatch: (
        expectedStrongEntityTag,
        source,
        limits,
        digestProvider,
      ) =>
        editor
          ? restoreDocumentEnvelopeBytesIfMatch(
              editor,
              expectedStrongEntityTag,
              source,
              limits,
              digestProvider,
            )
          : Promise.resolve(null),
      validateDocumentJson: (documentJson) => {
        const current = activeEditor(editor);
        return current ? validateDocumentJson(current, documentJson) : false;
      },
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
      insertDocumentJson: (documentJson) => {
        if (!editor) return;
        editor.chain().focus().insertContent(documentJson).run();
      },
      clear: () => {
        activeEditor(editor)?.commands.clearContent(true);
      },
      isEmpty: () => activeEditor(editor)?.isEmpty ?? true,
    }),
    [editor, modeRef],
  );
}
