import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { imageFileToInlineDataUri } from '../extensions/Base64Image.js';
import type { ImageConfig } from '../types.js';

interface ToolbarProps {
  editor: Editor;
  image?: ImageConfig;
  /** Forwarded from {@link CwlEditor} — image failures must reach the host. */
  onImageError?: (error: unknown) => void;
}

interface ButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  label: string;
}

function ToolbarButton({ onClick, active, disabled, title, label }: ButtonProps) {
  return (
    <button
      type="button"
      className={`cwl-tb-btn${active ? ' is-active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active ? 'true' : 'false'}
    >
      {label}
    </button>
  );
}

/**
 * Commercial-grade toolbar covering the common rich-text affordances:
 * marks, headings, lists, code, quote, link, horizontal rule, table insert +
 * edit (add/delete row/column, delete table), and inline-base64 image upload.
 * Uses `onMouseDown preventDefault` so clicks never steal the editor selection.
 */
export function Toolbar({ editor, image, onImageError }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Re-render on every transaction so active/disabled states (marks, table
  // cursor, undo/redo) stay in sync without host re-renders.
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const onUpdate = () => bump();
    editor.on('transaction', onUpdate);
    editor.on('selectionUpdate', onUpdate);
    return () => {
      editor.off('transaction', onUpdate);
      editor.off('selectionUpdate', onUpdate);
    };
  }, [editor]);

  const inTable = editor.isActive('table');

  const setLink = useCallback(() => {
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
  }, [editor]);

  const onPickImage = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const src = await imageFileToInlineDataUri(file, {
          maxSizeBytes: image?.maxSizeBytes ?? 10 * 1024 * 1024,
          maxDimension: image?.maxDimension ?? 1600,
          quality: image?.quality ?? 0.85,
        });
        editor.chain().focus().setImage({ src }).run();
      } catch (err) {
        onImageError?.(err);
      }
    },
    [editor, image, onImageError],
  );

  return (
    <div className="cwl-toolbar" role="toolbar" aria-label="Formatting">
      <div className="cwl-tb-group">
        <ToolbarButton
          title="Bold (Ctrl/Cmd+B)"
          label="B"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          title="Italic (Ctrl/Cmd+I)"
          label="I"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          title="Strikethrough"
          label="S"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          title="Inline code"
          label="</>"
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
      </div>

      <div className="cwl-tb-group">
        <ToolbarButton
          title="Heading 1"
          label="H1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          title="Heading 2"
          label="H2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          title="Heading 3"
          label="H3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
      </div>

      <div className="cwl-tb-group">
        <ToolbarButton
          title="Bullet list"
          label="• List"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          title="Ordered list"
          label="1. List"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          title="Blockquote"
          label="❝"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          title="Code block"
          label="{ }"
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        <ToolbarButton
          title="Horizontal rule"
          label="—"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </div>

      <div className="cwl-tb-group">
        <ToolbarButton
          title="Insert/edit link (Ctrl/Cmd+K)"
          label="🔗"
          active={editor.isActive('link')}
          onClick={setLink}
        />
        <ToolbarButton
          title="Insert table"
          label="▦"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        />
        <ToolbarButton
          title="Add column after"
          label="┼→"
          disabled={!inTable}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        />
        <ToolbarButton
          title="Add row after"
          label="┼↓"
          disabled={!inTable}
          onClick={() => editor.chain().focus().addRowAfter().run()}
        />
        <ToolbarButton
          title="Delete column"
          label="┼✕"
          disabled={!inTable}
          onClick={() => editor.chain().focus().deleteColumn().run()}
        />
        <ToolbarButton
          title="Delete row"
          label="┼↑✕"
          disabled={!inTable}
          onClick={() => editor.chain().focus().deleteRow().run()}
        />
        <ToolbarButton
          title="Delete table"
          label="▦✕"
          disabled={!inTable}
          onClick={() => editor.chain().focus().deleteTable().run()}
        />
        <ToolbarButton
          title="Insert inline (base64) image"
          label="🖼"
          onClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onPickImage}
        />
      </div>

      <div className="cwl-tb-group">
        <ToolbarButton
          title="Undo (Ctrl/Cmd+Z)"
          label="↶"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          title="Redo (Ctrl/Cmd+Shift+Z)"
          label="↷"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
    </div>
  );
}

export default Toolbar;
