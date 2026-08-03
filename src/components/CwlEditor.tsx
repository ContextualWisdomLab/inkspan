import { useEditor } from '@tiptap/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { buildExtensions } from '../extensions/kit.js';
import type { CwlEditorHandle, CwlEditorProps } from '../types.js';
import { EditorFrame } from './EditorFrame.js';
import { buildEditorAccessibilityAttributes } from './editorAccessibility.js';
import { editorHtmlToValue, editorValueToHtml } from './editorSerialization.js';
import { useEditorHandle } from './useEditorHandle.js';
import { useLatestRef } from './useLatestRef.js';

/**
 * CwlEditor — a commercial-grade rich-text editor with interchangeable
 * Markdown and HTML document modes.
 *
 * Images remain self-contained base64 data URIs, configuration is supplied by
 * props rather than environment variables, and host applications receive a
 * stable imperative API through {@link CwlEditorHandle}.
 */
export const CwlEditor = forwardRef<CwlEditorHandle, CwlEditorProps>(
  function CwlEditor(
    {
      mode = 'markdown',
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      onImageError,
      placeholder = 'Start writing…',
      editable = true,
      hideToolbar = false,
      image,
      className,
      onReady,
      ariaLabel,
      ariaLabelledBy,
      ariaDescribedBy,
      ariaErrorMessage,
      ariaInvalid,
      ariaRequired,
    },
    ref,
  ) {
    const isControlled = value !== undefined;
    const emittingRef = useRef(false);
    const modeRef = useLatestRef(mode);
    const onChangeRef = useLatestRef(onChange);
    const onFocusRef = useLatestRef(onFocus);
    const onBlurRef = useLatestRef(onBlur);
    const onImageErrorRef = useLatestRef(onImageError);
    const reportImageError = useCallback((error: Error) => {
      onImageErrorRef.current?.(error);
    }, [onImageErrorRef]);
    const editorAttributes = useMemo(
      () =>
        buildEditorAccessibilityAttributes({
          defaultLabel: 'Rich text editor',
          ariaLabel,
          ariaLabelledBy,
          ariaDescribedBy,
          ariaErrorMessage,
          ariaInvalid,
          ariaRequired,
          editable,
        }),
      [
        ariaLabel,
        ariaLabelledBy,
        ariaDescribedBy,
        ariaErrorMessage,
        ariaInvalid,
        ariaRequired,
        editable,
      ],
    );

    const editor = useEditor({
      editable,
      extensions: buildExtensions({
        placeholder,
        image,
        onImageError: reportImageError,
      }),
      content: editorValueToHtml(value ?? defaultValue ?? '', mode),
      editorProps: {
        attributes: editorAttributes,
      },
      onUpdate: ({ editor: instance }) => {
        const listener = onChangeRef.current;
        if (!listener) return;
        emittingRef.current = true;
        try {
          listener(editorHtmlToValue(instance.getHTML(), modeRef.current));
        } finally {
          emittingRef.current = false;
        }
      },
      onFocus: ({ editor: instance, event }) => {
        onFocusRef.current?.({ editor: instance, event });
      },
      onBlur: ({ editor: instance, event }) => {
        onBlurRef.current?.({ editor: instance, event });
      },
    });

    useEditorHandle(ref, editor, modeRef);

    useEffect(() => {
      if (editor && onReady) onReady(editor);
    }, [editor, onReady]);

    useEffect(() => {
      editor?.setEditable(editable);
    }, [editor, editable]);

    useEffect(() => {
      /* v8 ignore next -- the editor is created synchronously in supported React clients. */
      if (!editor) return;
      editor.setOptions({
        editorProps: {
          ...editor.options.editorProps,
          attributes: editorAttributes,
        },
      });
    }, [editor, editorAttributes]);

    useEffect(() => {
      if (!editor || !isControlled || emittingRef.current) return;
      const current = editorHtmlToValue(editor.getHTML(), mode);
      if (current !== value) {
        /* v8 ignore next -- isControlled guarantees value is defined. */
        const next = editorValueToHtml(value ?? '', mode);
        editor.commands.setContent(next, false);
      }
    }, [editor, isControlled, value, mode]);

    return (
      <EditorFrame
        editor={editor}
        mode={mode}
        editable={editable}
        hideToolbar={hideToolbar}
        image={image}
        className={className}
        onImageError={onImageError}
      />
    );
  },
);

export default CwlEditor;
