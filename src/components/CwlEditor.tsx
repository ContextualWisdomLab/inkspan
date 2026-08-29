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
    if (value !== undefined && typeof value !== 'string') {
      throw new RangeError('editor value must be a string when provided');
    }
    if (defaultValue !== undefined && typeof defaultValue !== 'string') {
      throw new RangeError(
        'editor default value must be a string when provided',
      );
    }
    if (formResetValue !== undefined && typeof formResetValue !== 'string') {
      throw new RangeError(
        'editor form reset value must be a string when provided',
      );
    }
    if (typeof editable !== 'boolean') {
      throw new RangeError('editor editable state must be a boolean when provided');
    }
    if (typeof hideToolbar !== 'boolean') {
      throw new RangeError(
        'editor toolbar visibility state must be a boolean when provided',
      );
    }

    const isControlled = value !== undefined;
    const selectedDocumentValue = value ?? defaultValue ?? '';
    const emittingRef = useRef(false);
    const hasPublishedInitialLegacyValueRef = useRef(false);
    const componentActiveRef = useRef(true);
    const compositionActiveRef = useRef(false);
    const compositionSnapshotPendingRef = useRef(false);
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

    useEffect(() => {
      componentActiveRef.current = true;
      return () => {
        componentActiveRef.current = false;
        compositionActiveRef.current = false;
        compositionSnapshotPendingRef.current = false;
      };
    }, []);

    const reportImageError = useCallback((error: Error) => {
      onImageErrorRef.current?.(error);
    }, [onImageErrorRef]);
    const reportClipboardError = useCallback(
      (error: ClipboardSanitizationError) => {
        onClipboardErrorRef.current?.(error);
      },
      [onClipboardErrorRef],
    );
    const beginComposition = useCallback(() => {
      compositionActiveRef.current = true;
      compositionSnapshotPendingRef.current = false;
    }, []);
    const endComposition = useCallback(() => {
      queueMicrotask(() => {
        if (!componentActiveRef.current) return;
        compositionActiveRef.current = false;
        if (compositionSnapshotPendingRef.current) {
          compositionSnapshotPendingRef.current = false;
          const instance = editorInstanceRef.current!;
          const snapshot = createEditorDocumentSnapshot(instance, modeRef.current);
          onDocumentChangeRef.current?.({ editor: instance, snapshot });
        }
      });
    }, [modeRef, onDocumentChangeRef]);
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
        instance.view.dom.addEventListener('compositionstart', beginComposition);
        instance.view.dom.addEventListener('compositionend', endComposition);
        onReadyRef.current?.(instance);
      },
      onDestroy: () => {
        const instance = editorInstanceRef.current!;
        instance.view.dom.removeEventListener('compositionstart', beginComposition);
        instance.view.dom.removeEventListener('compositionend', endComposition);
        compositionActiveRef.current = false;
        compositionSnapshotPendingRef.current = false;
        onDestroyRef.current?.(instance);
        editorInstanceRef.current = null;
      },
      onUpdate: ({ editor: instance }) => {
        const valueListener = onChangeRef.current;
        const snapshotListener = onDocumentChangeRef.current;
        if (!valueListener && !snapshotListener) return;
        emittingRef.current = true;
        try {
          if (
            snapshotListener &&
            !compositionActiveRef.current &&
            !instance.view.composing
          ) {
            const snapshot = createEditorDocumentSnapshot(
              instance,
              modeRef.current,
            );
            valueListener?.(snapshot.value);
            snapshotListener({ editor: instance, snapshot });
          } else {
            if (snapshotListener) {
              compositionSnapshotPendingRef.current = true;
            }
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
      if (!editor) return;
      if (!editable && editor.view.composing) {
        // ProseMirror treats compositionend as an edit event, so it will stop
        // processing that event after editability has already been revoked.
        // Drain the active local composition first to avoid stranding its
        // internal composing state across the read-only transition.
        const EventConstructor =
          editor.view.dom.ownerDocument.defaultView!.Event;
        editor.view.dom.dispatchEvent(new EventConstructor('compositionend'));
      }
      editor.setEditable(editable, false);
      if (!hasPublishedInitialLegacyValueRef.current) {
        hasPublishedInitialLegacyValueRef.current = true;
        // Preserve the historical `onChange` initialization signal without
        // misclassifying a non-document transaction as `onDocumentChange`.
        onChangeRef.current?.(
          editorHtmlToValue(editor.getHTML(), modeRef.current),
        );
      }
    }, [editor, editable, modeRef, onChangeRef]);

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

      const synchronizeValue = () => {
        if (!componentActiveRef.current) return;
        const current = editorHtmlToValue(editor.getHTML(), mode);
        if (current !== value) {
          /* v8 ignore next -- isControlled guarantees value is defined. */
          synchronizeControlledEditorValue(editor, value ?? '', mode);
        }
      };

      if (!editor.view.composing) {
        synchronizeValue();
        return;
      }

      const synchronizeAfterComposition = () => {
        // The composition lifecycle listener queues the committed local
        // snapshot first. Defer host replacement to the next microtask so a
        // controlled prop cannot overwrite that snapshot before publication.
        queueMicrotask(synchronizeValue);
      };
      editor.view.dom.addEventListener(
        'compositionend',
        synchronizeAfterComposition,
        { once: true },
      );
      return () => {
        editor.view.dom.removeEventListener(
          'compositionend',
          synchronizeAfterComposition,
        );
      };
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
