import { useEditor, EditorContent } from '@tiptap/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { buildExtensions } from '../extensions/kit.js';
import { htmlToMarkdown, markdownToHtml } from '../markdown/serializer.js';
import { Toolbar } from './Toolbar.js';
import type {
  CwlEditorHandle,
  CwlEditorProps,
  EditorMode,
} from '../types.js';

function toHtml(value: string, mode: EditorMode): string {
  return mode === 'markdown' ? markdownToHtml(value) : value;
}

function fromHtml(html: string, mode: EditorMode): string {
  return mode === 'markdown' ? htmlToMarkdown(html) : html;
}

/**
 * CwlEditor — a commercial-grade rich-text editor with two interchangeable
 * document modes:
 *
 *  - `mode="markdown"`: `value`/`onChange` speak CommonMark + GFM.
 *  - `mode="html"`: `value`/`onChange` speak HTML.
 *
 * In both modes, pasted/dropped/uploaded images are embedded **inline as
 * base64 data URIs**, so the serialized output is fully self-contained and an
 * LLM can read the image bytes straight from the document.
 *
 * Host integration:
 *  - Controlled or uncontrolled value
 *  - `ref` {@link CwlEditorHandle} for form submit / AI insert / focus
 *  - `onImageError` so size-guard failures are never silent
 *
 * All configuration is supplied through props (KV), never from process/OS env,
 * so the component is safe to embed in any host application.
 */
export const CwlEditor = forwardRef<CwlEditorHandle, CwlEditorProps>(
  function CwlEditor(
    {
      mode = 'markdown',
      value,
      defaultValue,
      onChange,
      onImageError,
      placeholder = 'Start writing…',
      editable = true,
      hideToolbar = false,
      image,
      className,
      onReady,
      ariaLabel = 'Rich text editor',
    },
    ref,
  ) {
    const isControlled = value !== undefined;
    // Guards a re-entrant setContent when we ourselves emitted the change.
    const emittingRef = useRef(false);
    const modeRef = useRef(mode);
    modeRef.current = mode;

    const editor = useEditor({
      editable,
      extensions: buildExtensions({ placeholder, image }),
      content: toHtml(value ?? defaultValue ?? '', mode),
      editorProps: {
        attributes: {
          class: 'cwl-editor__content',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': ariaLabel,
        },
      },
      onUpdate: ({ editor: instance }) => {
        if (!onChange) return;
        emittingRef.current = true;
        try {
          onChange(fromHtml(instance.getHTML(), modeRef.current));
        } finally {
          emittingRef.current = false;
        }
      },
    });

    useImperativeHandle(
      ref,
      (): CwlEditorHandle => ({
        getEditor: () => editor ?? null,
        focus: () => {
          editor?.chain().focus().run();
        },
        blur: () => {
          editor?.commands.blur();
        },
        getValue: () => {
          if (!editor) return '';
          return fromHtml(editor.getHTML(), modeRef.current);
        },
        getHTML: () => editor?.getHTML() ?? '',
        getMarkdown: () => {
          if (!editor) return '';
          return htmlToMarkdown(editor.getHTML());
        },
        setValue: (next: string) => {
          if (!editor) return;
          editor.commands.setContent(toHtml(next, modeRef.current), false);
        },
        clear: () => {
          editor?.commands.clearContent(true);
        },
        isEmpty: () => editor?.isEmpty ?? true,
      }),
      [editor],
    );

    // Expose the instance once ready.
    useEffect(() => {
      if (editor && onReady) onReady(editor);
    }, [editor, onReady]);

    // Keep editable flag in sync.
    useEffect(() => {
      editor?.setEditable(editable);
    }, [editor, editable]);

    // Controlled sync: push external value changes into the document without
    // clobbering the user's cursor when the change originated from typing.
    useEffect(() => {
      if (!editor || !isControlled || emittingRef.current) return;
      const current = fromHtml(editor.getHTML(), mode);
      if (current !== value) {
        // `value` is always a string here (isControlled === value !== undefined),
        // so the `?? ''` fallback is a type guard that never runs.
        /* v8 ignore next */
        const next = toHtml(value ?? '', mode);
        editor.commands.setContent(next, false);
      }
    }, [editor, isControlled, value, mode]);

    const onKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        // Defensive: key events can only reach the surface once the editor exists.
        /* v8 ignore next */
        if (!editor) return;
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.key.toLowerCase() === 'k') {
          e.preventDefault();
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
  },
);

export default CwlEditor;
