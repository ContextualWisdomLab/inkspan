import type { Editor } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import type { EditorMode } from '../types.js';
import { editorHtmlToValue } from './editorSerialization.js';

/** Props for the hidden native-form field maintained by an editor instance. */
export interface EditorFormFieldProps {
  editor: Editor | null;
  mode: EditorMode;
  name?: string;
  formId?: string;
  disabled?: boolean;
  /**
   * Selected standalone document value emitted in SSR markup and retained until
   * the hydrated TipTap editor becomes authoritative for the native field.
   */
  initialValue?: string;
  onFormReset?: (event: Event) => void;
}

/**
 * Mirror the current serialized document into a native hidden form field.
 *
 * Named fields subscribe only to document-changing transactions, avoiding a
 * full Markdown/HTML serialization on cursor movement while still observing
 * programmatic `setContent(..., false)` calls that intentionally suppress the
 * higher-level TipTap update event. The field's native value is written
 * synchronously before returning from each document transaction, so immediate
 * `FormData` construction or browser submission cannot observe a React-batched
 * stale value. During SSR-to-client handoff, the selected server value remains
 * the native field's default until TipTap reports that its document has been
 * initialized; the create event then establishes editor authority without a
 * transient empty submission value. Every named field restores its live
 * serialized value after the browser's native reset algorithm so a reset cannot
 * silently desynchronize FormData from an editor that the host chose not to
 * reset. Reset-only unnamed fields skip document serialization entirely. A
 * configured host reset observer is invoked in the same next-task boundary,
 * after native dispatch and reset processing.
 */
export function EditorFormField({
  editor,
  mode,
  name,
  formId,
  disabled,
  initialValue = '',
  onFormReset,
}: EditorFormFieldProps) {
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const serializedValueRef = useRef(initialValue);

  useEffect(() => {
    const field = fieldRef.current;
    /* v8 ignore next -- the effect runs only after the rendered field mounts. */
    if (!field) return;
    if (name === undefined) {
      serializedValueRef.current = '';
      field.value = '';
      return;
    }
    if (!editor) {
      serializedValueRef.current = initialValue;
      field.value = initialValue;
      return;
    }

    const synchronizeValue = () => {
      const nextValue = editorHtmlToValue(editor.getHTML(), mode);
      serializedValueRef.current = nextValue;
      field.value = nextValue;
    };
    const handleTransaction = ({
      transaction,
    }: {
      transaction: { docChanged: boolean };
    }) => {
      if (transaction.docChanged) synchronizeValue();
    };

    if (editor.isInitialized !== false) synchronizeValue();
    editor.on('create', synchronizeValue);
    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('create', synchronizeValue);
      editor.off('transaction', handleTransaction);
    };
  }, [editor, initialValue, mode, name]);

  useEffect(() => {
    if (name === undefined && !onFormReset) return;
    const field = fieldRef.current;
    /* v8 ignore next -- the effect runs only after the rendered field mounts. */
    if (!field) return;
    const eventRoot = field.getRootNode();
    const pendingResetTasks = new Set<ReturnType<typeof setTimeout>>();

    const handleReset = (event: Event) => {
      if (event.target !== field.form) return;
      const pendingTask = setTimeout(() => {
        pendingResetTasks.delete(pendingTask);
        if (event.defaultPrevented) return;
        if (name !== undefined) field.value = serializedValueRef.current;
        onFormReset?.(event);
      }, 0);
      pendingResetTasks.add(pendingTask);
    };

    eventRoot.addEventListener('reset', handleReset);
    return () => {
      eventRoot.removeEventListener('reset', handleReset);
      for (const pendingTask of pendingResetTasks) clearTimeout(pendingTask);
      pendingResetTasks.clear();
    };
  }, [formId, name, onFormReset]);

  if (name === undefined && onFormReset === undefined) return null;

  return (
    <input
      key={editor ? 'live-editor-field' : 'pre-editor-field'}
      ref={fieldRef}
      type="hidden"
      name={name}
      form={formId}
      disabled={disabled}
      defaultValue={name === undefined ? undefined : initialValue}
      data-inkspan-form-field=""
    />
  );
}

export default EditorFormField;
