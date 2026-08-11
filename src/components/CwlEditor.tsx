import { type Editor, useEditor } from '@tiptap/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { ClipboardSanitizationError } from '../extensions/SafeClipboard.js';
import { buildExtensions } from '../extensions/kit.js';
import type { CwlEditorHandle, CwlEditorProps } from '../types.js';
import { EditorFrame } from './EditorFrame.js';
import {
  buildEditorAccessibilityAttributes,
  normalizeEditorPlaceholder,
} from './editorAccessibility.js';
import { synchronizeControlledEditorValue } from './editorControlledValueSync.js';
import { createEditorDocumentSnapshot } from './editorDocumentSnapshot.js';
import { applyEditorFormReset } from './editorFormReset.js';
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
      formResetValue,
      onFormReset,
      languageTag,
      textDirection,
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
    const selectedDocumentValue = value ?? defaultValue ?? '';
    const emittingRef = useRef(false);
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
    const formResetValueRef = useLatestRef(formResetValue);
    const onFormResetRef = useLatestRef(onFormReset);
    const reportImageError = useCallback((error: Error) => {
      onImageErrorRef.current?.(error);
    }, [onImageErrorRef]);
    const reportClipboardError = useCallback(
      (error: ClipboardSanitizationError) => {
        onClipboardErrorRef.current?.(error);
      },
      [onClipboardErrorRef],
    );
    const normalizedPlaceholder = useMemo(
      () => normalizeEditorPlaceholder(placeholder),
      [placeholder],
    );
    const placeholderRef = useLatestRef(normalizedPlaceholder ?? '');
    const editorAttributes = useMemo(
      () =>
        buildEditorAccessibilityAttributes({
          defaultLabel: 'Rich text editor',
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

    const editor = useEditor({
      immediatelyRender: false,
      editable,
      extensions: buildExtensions({
        placeholder: () => placeholderRef.current,
        image,
        clipboard,
        onImageError: reportImageError,
        onClipboardError: reportClipboardError,
      }),
      content: editorValueToHtml(selectedDocumentValue, mode),
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
        emittingRef.current = true;
        try {
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
        } finally {
          emittingRef.current = false;
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
    });

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
      if (!editor || !isControlled || emittingRef.current) return;
      const current = editorHtmlToValue(editor.getHTML(), mode);
      if (current !== value) {
        /* v8 ignore next -- isControlled guarantees value is defined. */
        synchronizeControlledEditorValue(editor, value ?? '', mode);
      }
    }, [editor, isControlled, value, mode]);

    const handleFormReset = useCallback(
      (event: Event) => {
        applyEditorFormReset({
          /* v8 ignore next -- the handler is passed only while editor exists. */
          editor: editor!,
          mode: modeRef.current,
          resetValue: formResetValueRef.current,
          event,
          onChange: onChangeRef.current,
          onFormReset: onFormResetRef.current,
        });
      },
      [editor, formResetValueRef, modeRef, onChangeRef, onFormResetRef],
    );
    const observesFormReset =
      formResetValue !== undefined || onFormReset !== undefined;

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
        formFieldInitialValue={selectedDocumentValue}
        onFormReset={editor && observesFormReset ? handleFormReset : undefined}
      />
    );
  },
);

export default CwlEditor;
