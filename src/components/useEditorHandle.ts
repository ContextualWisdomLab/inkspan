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
      getDocumentEnvelope: (limits) =>
        editor ? createCurrentDocumentEnvelope(editor, limits) : null,
      getDocumentEnvelopeJson: (limits) =>
        editor
          ? serializeValidatedDocumentEnvelope(
              createCurrentDocumentEnvelope(editor, limits),
            )
          : '',
      getDocumentEnvelopeBytes: (limits) =>
        editor
          ? encodeValidatedDocumentEnvelope(
              createCurrentDocumentEnvelope(editor, limits),
            )
          : new Uint8Array(),
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
        if (!editor) return;
        editor.commands.setContent(
          editorValueToHtml(next, modeRef.current),
          false,
        );
      },
      validateDocumentEnvelope: (source, limits) =>
        editor
          ? validateDocumentEnvelopeForEditor(editor, source, limits)
          : false,
      validateDocumentEnvelopeBytes: (source, limits) =>
        editor
          ? validateDocumentEnvelopeBytesForEditor(editor, source, limits)
          : false,
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
      insertDocumentJson: (documentJson) => {
        if (!editor) return;
        editor.chain().focus().insertContent(documentJson).run();
      },
      clear: () => {
        editor?.commands.clearContent(true);
      },
      isEmpty: () => editor?.isEmpty ?? true,
    }),
    [editor, modeRef],
  );
}
