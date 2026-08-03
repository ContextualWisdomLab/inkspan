import { EditorContent, type Editor } from '@tiptap/react';
import { useCallback, type KeyboardEvent, type ReactNode } from 'react';
import type { EditorMode, ImageConfig } from '../types.js';
import { Toolbar } from './Toolbar.js';

/** Props for the visual editor shell shared by every Inkspan editing mode. */
export interface EditorFrameProps {
  editor: Editor | null;
  mode: EditorMode;
  editable: boolean;
  hideToolbar: boolean;
  image?: ImageConfig;
  className?: string;
  onImageError?: (error: unknown) => void;
  status?: ReactNode;
}

/**
 * Render the common Inkspan root, toolbar, keyboard surface, and editor content
 * without owning document state or transport lifecycle.
 */
export function EditorFrame({
  editor,
  mode,
  editable,
  hideToolbar,
  image,
  className,
  onImageError,
  status,
}: EditorFrameProps) {
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!editor) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || event.key.toLowerCase() !== 'k') return;

      event.preventDefault();
      const previous = editor.getAttributes('link').href as string | undefined;
      const url = window.prompt('Link URL', previous ?? 'https://');
      if (url === null) return;
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run();
    },
    [editor],
  );

  return (
    <div
      className={`cwl-editor${className ? ` ${className}` : ''}`}
      data-mode={mode}
    >
      {status}
      {!hideToolbar && editor && editable ? (
        <Toolbar
          editor={editor}
          image={image}
          onImageError={onImageError}
        />
      ) : null}
      <div className="cwl-editor__surface" onKeyDown={onKeyDown}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default EditorFrame;
