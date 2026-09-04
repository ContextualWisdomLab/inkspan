import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { type Editor, useEditor } from '@tiptap/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EditorFrame } from '../components/EditorFrame.js';
import {
  buildEditorAccessibilityAttributes,
  normalizeEditorPlaceholder,
} from '../components/editorAccessibility.js';
import { createEditorDocumentSnapshot } from '../components/editorDocumentSnapshot.js';
import { applyEditorFormReset } from '../components/editorFormReset.js';
import { editorHtmlToValue } from '../components/editorSerialization.js';
import { useEditorHandle } from '../components/useEditorHandle.js';
import { useLatestRef } from '../components/useLatestRef.js';
import type { ClipboardSanitizationError } from '../extensions/SafeClipboard.js';
import { buildExtensions } from '../extensions/kit.js';
import type { CwlEditorHandle } from '../types.js';
import {
  assertCollaborationConfiguration,
  collaborationConnectionLabel,
  countRemoteCollaborators,
  createScopedCollaborationProvider,
  renderCollaborationCursor,
  renderCollaborationSelection,
  serializeCollaborationUser,
} from './awareness.js';
import type { CollaborativeCwlEditorProps } from './types.js';

/**
 * Provider-neutral collaborative Inkspan surface backed exclusively by a
 * host-owned Yjs document. Inkspan owns neither network nor persistence
 * lifecycle and never destroys the supplied document or provider.
 */
export const CollaborativeCwlEditor = forwardRef<
  CwlEditorHandle,
  CollaborativeCwlEditorProps
>(function CollaborativeCwlEditor(props, ref) {
  const legacyProps = props as {
    value?: unknown;
    defaultValue?: unknown;
    formResetValue?: unknown;
  };
  if (
    legacyProps.value !== undefined ||
    legacyProps.defaultValue !== undefined
  ) {
    throw new Error(
      'collaborative editors use the Yjs document as the sole source of truth; value and defaultValue are not allowed',
    );
  }
  if (legacyProps.formResetValue !== undefined) {
    throw new Error(
      'collaborative editors require host-authorized reset handling through onFormReset; formResetValue is not allowed',
    );
  }

  const {
    document: collaborationDocument,
    provider,
    user,
    field = 'default',
    connectionStatus,
    mode = 'markdown',
    onChange,
    onDocumentChange,
    onFocus,
    onBlur,
    onSelectionChange,
    onImageError,
    clipboard,
    onClipboardError,
    placeholder = 'Start writing…',
    editable = true,
    hideToolbar = false,
    image,
    className,
    onReady,
    onDestroy,
    formFieldName,
    formId,
    formFieldDisabled,
    onFormReset,
    languageTag,
    textDirection,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    ariaErrorMessage,
    ariaInvalid,
    ariaRequired,
  } = props;

  assertCollaborationConfiguration(provider, user);
  if (field.trim() === '') {
    throw new Error('collaboration field must not be empty');
  }
  if (
    !collaborationDocument ||
    typeof collaborationDocument.getXmlFragment !== 'function'
  ) {
    throw new Error('collaboration document must be a Y.Doc instance');
  }

  const normalizedField = field.trim();
  const normalizedPlaceholder = useMemo(
    () => normalizeEditorPlaceholder(placeholder),
    [placeholder],
  );
  const cursorUser = user ? serializeCollaborationUser(user) : undefined;
  const presenceEnabled = provider !== undefined && cursorUser !== undefined;
  const scopedProvider = useMemo(
    () =>
      provider && presenceEnabled
        ? createScopedCollaborationProvider(provider)
        : undefined,
    [provider, presenceEnabled],
  );
  useEffect(
    () => () => {
      scopedProvider?.dispose();
    },
    [scopedProvider],
  );

  const editorInstanceRef = useRef<Editor | null>(null);
  const modeRef = useLatestRef(mode);
  const onChangeRef = useLatestRef(onChange);
  const onDocumentChangeRef = useLatestRef(onDocumentChange);
  const onFocusRef = useLatestRef(onFocus);
  const onBlurRef = useLatestRef(onBlur);
  const onSelectionChangeRef = useLatestRef(onSelectionChange);
  const onImageErrorRef = useLatestRef(onImageError);
  const onClipboardErrorRef = useLatestRef(onClipboardError);
  const onReadyRef = useLatestRef(onReady);
  const onDestroyRef = useLatestRef(onDestroy);
  const onFormResetRef = useLatestRef(onFormReset);
  const placeholderRef = useLatestRef(normalizedPlaceholder ?? '');
  const reportImageError = useCallback((error: Error) => {
    onImageErrorRef.current?.(error);
  }, [onImageErrorRef]);
  const reportClipboardError = useCallback(
    (error: ClipboardSanitizationError) => {
      onClipboardErrorRef.current?.(error);
    },
    [onClipboardErrorRef],
  );
  const editorAttributes = useMemo(
    () =>
      buildEditorAccessibilityAttributes({
        defaultLabel: 'Collaborative rich text editor',
        placeholder: normalizedPlaceholder,
        languageTag,
        textDirection,
        ariaLabel,
        ariaLabelledBy,
        ariaDescribedBy,
        ariaErrorMessage,
        ariaInvalid,
        ariaRequired,
        editable,
      }),
    [
      normalizedPlaceholder,
      languageTag,
      textDirection,
      ariaLabel,
      ariaLabelledBy,
      ariaDescribedBy,
      ariaErrorMessage,
      ariaInvalid,
      ariaRequired,
      editable,
    ],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions: buildExtensions({
        placeholder: () => placeholderRef.current,
        image,
        clipboard,
        onImageError: reportImageError,
        onClipboardError: reportClipboardError,
        disableHistory: true,
        additionalExtensions: [
          Collaboration.configure({
            document: collaborationDocument,
            field: normalizedField,
          }),
          ...(scopedProvider && cursorUser
            ? [
                CollaborationCaret.configure({
                  provider: scopedProvider,
                  user: cursorUser,
                  render: renderCollaborationCursor,
                  selectionRender: renderCollaborationSelection,
                }),
              ]
            : []),
        ],
      }),
      editorProps: {
        attributes: editorAttributes,
      },
      onCreate: ({ editor: instance }) => {
        editorInstanceRef.current = instance;
        onReadyRef.current?.(instance);
      },
      onDestroy: () => {
        const instance = editorInstanceRef.current!;
        onDestroyRef.current?.(instance);
        editorInstanceRef.current = null;
      },
      onUpdate: ({ editor: instance }) => {
        const valueListener = onChangeRef.current;
        const snapshotListener = onDocumentChangeRef.current;
        if (!valueListener && !snapshotListener) return;
        if (snapshotListener) {
          const snapshot = createEditorDocumentSnapshot(
            instance,
            modeRef.current,
          );
          valueListener?.(snapshot.value);
          snapshotListener({ editor: instance, snapshot });
        } else {
          valueListener?.(
            editorHtmlToValue(instance.getHTML(), modeRef.current),
          );
        }
      },
      onSelectionUpdate: ({ editor: instance }) => {
        const { selection } = instance.state;
        onSelectionChangeRef.current?.({
          editor: instance,
          selection: {
            anchor: selection.anchor,
            head: selection.head,
            from: selection.from,
            to: selection.to,
            empty: selection.empty,
          },
        });
      },
      onFocus: ({ editor: instance, event }) => {
        onFocusRef.current?.({ editor: instance, event });
      },
      onBlur: ({ editor: instance, event }) => {
        onBlurRef.current?.({ editor: instance, event });
      },
    },
    [collaborationDocument, scopedProvider, normalizedField, presenceEnabled],
  );

  useEditorHandle(ref, editor, modeRef);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    /* v8 ignore next -- the editor is created after client hydration. */
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: editorAttributes,
      },
    });
  }, [editor, editorAttributes]);

  useEffect(() => {
    if (!editor || !cursorUser || !presenceEnabled) return;
    editor.commands.updateUser(cursorUser);
  }, [
    editor,
    cursorUser?.id,
    cursorUser?.name,
    cursorUser?.color,
    presenceEnabled,
  ]);

  const [remoteCollaborators, setRemoteCollaborators] = useState(() =>
    countRemoteCollaborators(provider?.awareness),
  );
  useEffect(() => {
    const awareness = provider?.awareness;
    const updateCount = () => {
      setRemoteCollaborators(countRemoteCollaborators(awareness));
    };
    updateCount();
    if (!awareness) return;
    awareness.on('change', updateCount);
    return () => awareness.off('change', updateCount);
  }, [provider]);

  const collaboratorLabel =
    remoteCollaborators === 1
      ? '1 remote collaborator'
      : `${remoteCollaborators} remote collaborators`;
  const status = (
    <div
      className="cwl-collaboration-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span>{collaborationConnectionLabel(connectionStatus)}</span>
      <span aria-hidden="true"> · </span>
      <span>{collaboratorLabel}</span>
    </div>
  );

  const handleFormReset = useCallback(
    (event: Event) => {
      applyEditorFormReset({
        /* v8 ignore next -- the handler is passed only while editor exists. */
        editor: editor!,
        mode: modeRef.current,
        event,
        onFormReset: onFormResetRef.current,
      });
    },
    [editor, modeRef, onFormResetRef],
  );

  return (
    <EditorFrame
      editor={editor}
      mode={mode}
      editable={editable}
      hideToolbar={hideToolbar}
      image={image}
      className={className}
      onImageError={onImageError}
      formFieldName={formFieldName}
      formId={formId}
      formFieldDisabled={formFieldDisabled}
      onFormReset={editor && onFormReset ? handleFormReset : undefined}
      status={status}
    />
  );
});

export default CollaborativeCwlEditor;
