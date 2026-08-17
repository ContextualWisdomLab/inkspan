import type { Editor } from '@tiptap/react';
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { imageFileToInlineDataUri } from '../extensions/Base64Image.js';
import { spreadsheetFileToDocumentJson } from '../spreadsheet/index.js';
import type { ImageConfig } from '../types.js';

interface ToolbarProps {
  editor: Editor;
  image?: ImageConfig;
  /** Forwarded from {@link CwlEditor} — image failures must reach the host. */
  onImageError?: (error: unknown) => void;
  /** Optional host observer for payload-redacted spreadsheet import failures. */
  onSpreadsheetError?: (error: unknown) => void;
}

interface ButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  label: string;
  /** WAI-ARIA key shortcut tokens for shortcuts already implemented by the editor. */
  keyShortcuts?: string;
}

const TOOLBAR_ITEM_SELECTOR = 'button[data-cwl-toolbar-item="true"]';
const SPREADSHEET_ACCEPT =
  '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Return every toolbar button in visual and DOM navigation order. */
function getToolbarButtons(toolbar: HTMLDivElement): HTMLButtonElement[] {
  return Array.from(
    toolbar.querySelectorAll<HTMLButtonElement>(TOOLBAR_ITEM_SELECTOR),
  );
}

/** Keep exactly one enabled toolbar button in the document tab sequence. */
function setRovingTabStop(
  toolbar: HTMLDivElement,
  target: HTMLButtonElement,
): void {
  for (const button of getToolbarButtons(toolbar)) {
    button.tabIndex = button === target ? 0 : -1;
  }
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  label,
  keyShortcuts,
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`cwl-tb-btn${active ? ' is-active' : ''}`}
      data-cwl-toolbar-item="true"
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-keyshortcuts={keyShortcuts}
      aria-pressed={active === undefined ? undefined : active}
    >
      {label}
    </button>
  );
}

/**
 * Commercial-grade toolbar covering the common rich-text affordances:
 * marks, headings, lists, code, quote, link, horizontal rule, table insert +
 * edit, inline-base64 image upload, local spreadsheet insertion, and image
 * alternative-text authoring.
 *
 * The toolbar follows the WAI-ARIA composite-toolbar keyboard model: it is one
 * tab stop, Left/Right arrows move between enabled controls with wrapping, and
 * Home/End move to the first/last enabled control. `onMouseDown` preserves the
 * editor selection when pointer users invoke a formatting action. Shortcuts
 * already implemented by the editor are exposed with `aria-keyshortcuts` so
 * assistive technology receives the same cross-platform commands as tooltips.
 */
export function Toolbar({
  editor,
  image,
  onImageError,
  onSpreadsheetError,
}: ToolbarProps) {
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const spreadsheetFileInputRef = useRef<HTMLInputElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedButtonRef = useRef<HTMLButtonElement | null>(null);
  const [spreadsheetBusy, setSpreadsheetBusy] = useState(false);
  const [spreadsheetStatus, setSpreadsheetStatus] = useState('');
  // Re-render on every transaction so active/disabled states (marks, image and
  // table selection, undo/redo) stay in sync without host re-renders.
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

  useEffect(() => {
    const toolbar = toolbarRef.current;
    /* v8 ignore next -- the effect only runs after the toolbar div mounts. */
    if (!toolbar) return;
    const buttons = getToolbarButtons(toolbar);
    const remembered = lastFocusedButtonRef.current;
    const target =
      remembered && !remembered.disabled
        ? remembered
        : buttons.find((button) => !button.disabled)!;
    setRovingTabStop(toolbar, target);
  });

  const onToolbarFocus = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    lastFocusedButtonRef.current = target;
    setRovingTabStop(event.currentTarget, target);
  }, []);

  const onToolbarKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;

      const buttons = getToolbarButtons(event.currentTarget).filter(
        (button) => !button.disabled,
      );
      const currentIndex = buttons.indexOf(target);
      /* v8 ignore next -- native disabled buttons cannot receive keyboard focus. */
      if (currentIndex < 0) return;

      let nextIndex: number;
      switch (event.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % buttons.length;
          break;
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = buttons.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const nextButton = buttons[nextIndex]!;
      lastFocusedButtonRef.current = nextButton;
      setRovingTabStop(event.currentTarget, nextButton);
      nextButton.focus();
    },
    [],
  );

  const inTable = editor.isActive('table');
  const imageSelected = editor.isActive('image');

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

  const setImageAlternativeText = useCallback(() => {
    if (!editor.isActive('image')) return;
    const attributes = editor.getAttributes('image');
    const previous = typeof attributes.alt === 'string' ? attributes.alt : '';
    const alternativeText = window.prompt(
      'Image alternative text. Leave empty for a decorative image.',
      previous,
    );
    if (alternativeText === null) return;
    editor
      .chain()
      .focus()
      .updateAttributes('image', { alt: alternativeText })
      .run();
  }, [editor]);

  const onPickImage = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      let src: string;
      try {
        src = await imageFileToInlineDataUri(file, {
          maxSizeBytes: image?.maxSizeBytes ?? 10 * 1024 * 1024,
          maxDimension: image?.maxDimension ?? 1600,
          quality: image?.quality ?? 0.85,
        });
      } catch (err) {
        onImageError?.(err);
        return;
      }

      const alternativeText = window.prompt(
        'Image alternative text. Leave empty only if this image is decorative.',
        '',
      );
      if (alternativeText === null) return;

      editor.chain().focus().setImage({ src, alt: alternativeText }).run();
    },
    [editor, image, onImageError],
  );

  const onPickSpreadsheet = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || spreadsheetBusy) return;

      setSpreadsheetBusy(true);
      setSpreadsheetStatus('Importing spreadsheet…');
      try {
        const result = await spreadsheetFileToDocumentJson(file);
        if (result.content.length > 0) {
          const inserted = editor
            .chain()
            .focus()
            .insertContent(result.content)
            .run();
          if (!inserted) throw new Error('Spreadsheet insertion was rejected.');
        }
        setSpreadsheetStatus(
          `Imported ${result.worksheetCount} ${result.worksheetCount === 1 ? 'worksheet' : 'worksheets'}, ${result.rowCount} ${result.rowCount === 1 ? 'row' : 'rows'}, and ${result.cellCount} ${result.cellCount === 1 ? 'cell' : 'cells'}.`,
        );
      } catch (error) {
        onSpreadsheetError?.(error);
        setSpreadsheetStatus('Spreadsheet import failed.');
      } finally {
        setSpreadsheetBusy(false);
      }
    },
    [editor, onSpreadsheetError, spreadsheetBusy],
  );

  return (
    <div
      ref={toolbarRef}
      className="cwl-toolbar"
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="horizontal"
      onFocusCapture={onToolbarFocus}
      onKeyDown={onToolbarKeyDown}
    >
      <div className="cwl-tb-group">
        <ToolbarButton
          title="Bold (Ctrl/Cmd+B)"
          label="B"
          keyShortcuts="Control+B Meta+B"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          title="Italic (Ctrl/Cmd+I)"
          label="I"
          keyShortcuts="Control+I Meta+I"
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
          keyShortcuts="Control+K Meta+K"
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
          onClick={() => imageFileInputRef.current?.click()}
        />
        <ToolbarButton
          title="Insert XLS/XLSX spreadsheet"
          label="XLS"
          disabled={spreadsheetBusy}
          onClick={() => spreadsheetFileInputRef.current?.click()}
        />
        <ToolbarButton
          title="Edit image alternative text"
          label="Alt"
          disabled={!imageSelected}
          onClick={setImageAlternativeText}
        />
        <input
          ref={imageFileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onPickImage}
        />
        <input
          ref={spreadsheetFileInputRef}
          data-cwl-spreadsheet-input="true"
          type="file"
          accept={SPREADSHEET_ACCEPT}
          hidden
          disabled={spreadsheetBusy}
          onChange={onPickSpreadsheet}
        />
      </div>

      <div className="cwl-tb-group">
        <ToolbarButton
          title="Undo (Ctrl/Cmd+Z)"
          label="↶"
          keyShortcuts="Control+Z Meta+Z"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          title="Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y)"
          label="↷"
          keyShortcuts="Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>

      <span
        className="cwl-toolbar__status"
        role={spreadsheetStatus ? 'status' : undefined}
        aria-live="polite"
        aria-atomic="true"
      >
        {spreadsheetStatus}
      </span>
    </div>
  );
}

export default Toolbar;
