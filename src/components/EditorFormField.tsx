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
 * stale value. Reset-only unnamed fields skip document serialization entirely.
 * When configured, the field observes the associated form's cancelable reset
 * event and schedules editor work in the next task, after native dispatch and
 * the reset algorithm have completed.
 */
export function EditorFormField({
  editor,
  mode,
  name,
  formId,
  disabled,
  onFormReset,
}: EditorFormFieldProps) {
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const serializedValueRef = useRef('');

  useEffect(() => {
    const field = fieldRef.current!;
    if (!editor || name === undefined) {
      serializedValueRef.current = '';
      field.value = '';
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

    synchronizeValue();
    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor, mode, name]);

  useEffect(() => {
    if (!onFormReset) return;
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
        onFormReset(event);
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
      ref={fieldRef}
      type="hidden"
      name={name}
      form={formId}
      disabled={disabled}
      data-inkspan-form-field=""
    />
  );
}

export default EditorFormField;
