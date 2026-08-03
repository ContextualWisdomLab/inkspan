import { EditorContent, type Editor } from '@tiptap/react';
import { useCallback, type KeyboardEvent, type ReactNode } from 'react';
import type { EditorMode, ImageConfig } from '../types.js';
import { EditorFormField } from './EditorFormField.js';
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
  formFieldName?: string;
  formId?: string;
  formFieldDisabled?: boolean;
  onFormReset?: (event: Event) => void;
  status?: ReactNode;
}

/**
 * Render the common Inkspan root, toolbar, keyboard surface, native form field,
 * and editor content without owning document state or transport lifecycle.
 */
export function EditorFrame({
  editor,
  mode,
  editable,
  hideToolbar,
  image,
  className,
  onImageError,
  formFieldName,
  formId,
  formFieldDisabled,
  onFormReset,
  status,
}: EditorFrameProps) {
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      /* v8 ignore next -- keyboard events cannot reach an unmounted editor. */
      if (!editor) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const previous = editor.getAttributes('link').href as
          | string
          | undefined;
        const url = window.prompt('Link URL', previous ?? 'https://');
        if (url === null) return;
        if (url === '') {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
          editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .setLink({ href: url })
            .run();
        }
      }
    },
    [editor],
  );

  return (
    <div
      className={`cwl-editor${className ? ` ${className}` : ''}`}
      data-mode={mode}
    >
      <EditorFormField
        editor={editor}
        mode={mode}
        name={formFieldName}
        formId={formId}
        disabled={formFieldDisabled}
        onFormReset={onFormReset}
      />
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
