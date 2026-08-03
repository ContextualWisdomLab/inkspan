import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { useEditor } from '@tiptap/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { EditorFrame } from '../components/EditorFrame.js';
import { editorHtmlToValue } from '../components/editorSerialization.js';
import { useEditorHandle } from '../components/useEditorHandle.js';
import { buildExtensions } from '../extensions/kit.js';
import type { CwlEditorHandle } from '../types.js';
import {
  assertCollaborationConfiguration,
  collaborationConnectionLabel,
  countRemoteCollaborators,
  renderCollaborationCursor,
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
  if ('value' in props || 'defaultValue' in props) {
    throw new Error(
      'collaborative editors use the Yjs document as the sole source of truth; value and defaultValue are not allowed',
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
    onImageError,
    placeholder = 'Start writing…',
    editable = true,
    hideToolbar = false,
    image,
    className,
    onReady,
    ariaLabel = 'Collaborative rich text editor',
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
  const cursorUser = user ? serializeCollaborationUser(user) : undefined;
  const presenceEnabled = provider !== undefined && cursorUser !== undefined;

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onImageErrorRef = useRef(onImageError);
  onImageErrorRef.current = onImageError;
  const reportImageError = useCallback((error: Error) => {
    onImageErrorRef.current?.(error);
  }, []);

  const editor = useEditor(
    {
      editable,
      extensions: buildExtensions({
        placeholder,
        image,
        onImageError: reportImageError,
        disableHistory: true,
        additionalExtensions: [
          Collaboration.configure({
            document: collaborationDocument,
            field: normalizedField,
          }),
          ...(presenceEnabled
            ? [
                CollaborationCursor.configure({
                  provider,
                  user: cursorUser,
                  render: renderCollaborationCursor,
                }),
              ]
            : []),
        ],
      }),
      editorProps: {
        attributes: {
          class: 'cwl-editor__content',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': ariaLabel,
        },
      },
      onUpdate: ({ editor: instance }) => {
        onChangeRef.current?.(
          editorHtmlToValue(instance.getHTML(), modeRef.current),
        );
      },
    },
    [collaborationDocument, provider, normalizedField, presenceEnabled],
  );

  useEditorHandle(ref, editor, modeRef);

  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

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

  return (
    <EditorFrame
      editor={editor}
      mode={mode}
      editable={editable}
      hideToolbar={hideToolbar}
      image={image}
      className={className}
      onImageError={onImageError}
      status={status}
    />
  );
});

export default CollaborativeCwlEditor;
