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

/** Return an editor that currently permits user-facing history commands. */
function editableHistoryEditor(editor: Editor | null): Editor | null {
  const current = activeEditor(editor);
  return current?.isEditable ? current : null;
}

/** Validate host-provided imperative text before parser or editor access. */
function assertEditorTextValue(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError('editor value must be a string.');
  }
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
      canUndo: () => editableHistoryEditor(editor)?.can().undo() ?? false,
      undo: () =>
        editableHistoryEditor(editor)?.chain().focus().undo().run() ?? false,
      canRedo: () => editableHistoryEditor(editor)?.can().redo() ?? false,
      redo: () =>
        editableHistoryEditor(editor)?.chain().focus().redo().run() ?? false,
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
      getDocumentEnvelopeRevision: (limits, digestProvider) => {
        const current = activeEditor(editor);
        return current
          ? createValidatedDocumentEnvelopeRevision(
              createCurrentDocumentEnvelope(current, limits),
              digestProvider,
            )
          : Promise.resolve(null);
      },
      getDocumentEnvelopeRevisionEvidence: (limits, digestProvider) => {
        const current = activeEditor(editor);
        return current
          ? createValidatedDocumentEnvelopeRevisionEvidence(
              createCurrentDocumentEnvelope(current, limits),
              digestProvider,
            )
          : Promise.resolve(null);
      },
      getSelectionRevisionEvidence: async (limits, digestProvider) => {
        const current = activeEditor(editor);
        if (!current) return null;
        const state = current.state;
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
        const current = activeEditor(editor);
        if (!current) return null;
        const state = current.state;
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
        assertEditorTextValue(next);
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
      restoreDocumentEnvelope: (source, limits) => {
        const current = activeEditor(editor);
        return current ? restoreDocumentEnvelope(current, source, limits) : null;
      },
      restoreDocumentEnvelopeBytes: (source, limits) => {
        const current = activeEditor(editor);
        return current
          ? restoreDocumentEnvelopeBytes(current, source, limits)
          : null;
      },
      restoreDocumentEnvelopeIfMatch: (
        expectedStrongEntityTag,
        source,
        limits,
        digestProvider,
      ) => {
        const current = activeEditor(editor);
        return current
          ? restoreDocumentEnvelopeIfMatch(
              current,
              expectedStrongEntityTag,
              source,
              limits,
              digestProvider,
            )
          : Promise.resolve(null);
      },
      restoreDocumentEnvelopeBytesIfMatch: (
        expectedStrongEntityTag,
        source,
        limits,
        digestProvider,
      ) => {
        const current = activeEditor(editor);
        return current
          ? restoreDocumentEnvelopeBytesIfMatch(
              current,
              expectedStrongEntityTag,
              source,
              limits,
              digestProvider,
            )
          : Promise.resolve(null);
      },
      validateDocumentJson: (documentJson) => {
        const current = activeEditor(editor);
        return current ? validateDocumentJson(current, documentJson) : false;
      },
      setDocumentJson: (documentJson) => {
        const current = activeEditor(editor);
        if (!current) return;
        const documentNode = parseDocumentJsonForEditor(current, documentJson);
        current.commands.setContent(documentNode, false);
      },
      insertValue: (next: string) => {
        const current = activeEditor(editor);
        if (!current) return;
        assertEditorTextValue(next);
        current
          .chain()
          .focus()
          .insertContent(editorValueToHtml(next, modeRef.current))
          .run();
      },
      insertDocumentJson: (documentJson) => {
        const current = activeEditor(editor);
        if (!current) return;
        current.chain().focus().insertContent(documentJson).run();
      },
      clear: () => {
        activeEditor(editor)?.commands.clearContent(true);
      },
      isEmpty: () => activeEditor(editor)?.isEmpty ?? true,
    }),
    [editor, modeRef],
  );
}
