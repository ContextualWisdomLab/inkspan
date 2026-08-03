import type { Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
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
 * higher-level TipTap update event. Reset-only unnamed fields skip document
 * serialization entirely. When configured, the field also observes the
 * associated form's cancelable reset event and notifies the editor only after
 * every listener has had an opportunity to cancel the native reset.
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
  const [serializedValue, setSerializedValue] = useState('');

  useEffect(() => {
    if (!editor || name === undefined) {
      setSerializedValue('');
      return;
    }

    const synchronizeValue = () => {
      setSerializedValue(editorHtmlToValue(editor.getHTML(), mode));
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

    const handleReset = (event: Event) => {
      if (event.target !== field.form) return;
      queueMicrotask(() => {
        if (!event.defaultPrevented) onFormReset(event);
      });
    };

    eventRoot.addEventListener('reset', handleReset);
    return () => {
      eventRoot.removeEventListener('reset', handleReset);
    };
  }, [formId, name, onFormReset]);

  if (name === undefined && onFormReset === undefined) return null;

  return (
    <input
      ref={fieldRef}
      type="hidden"
      name={name}
      value={serializedValue}
      form={formId}
      disabled={disabled}
      data-inkspan-form-field=""
    />
  );
}

export default EditorFormField;
