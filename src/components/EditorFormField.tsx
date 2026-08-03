import type { Editor } from '@tiptap/react';
import { useEffect, useState } from 'react';
import type { EditorMode } from '../types.js';
import { editorHtmlToValue } from './editorSerialization.js';

/** Props for the hidden native-form field maintained by an editor instance. */
export interface EditorFormFieldProps {
  editor: Editor | null;
  mode: EditorMode;
  name?: string;
  formId?: string;
  disabled?: boolean;
}

/**
 * Mirror the current serialized document into a native hidden form field.
 *
 * The field subscribes only to document-changing transactions, avoiding a full
 * Markdown/HTML serialization on cursor movement while still observing
 * programmatic `setContent(..., false)` calls that intentionally suppress the
 * higher-level TipTap update event.
 */
export function EditorFormField({
  editor,
  mode,
  name,
  formId,
  disabled,
}: EditorFormFieldProps) {
  const [serializedValue, setSerializedValue] = useState('');

  useEffect(() => {
    if (!editor) {
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
    return () => editor.off('transaction', handleTransaction);
  }, [editor, mode]);

  if (name === undefined) return null;

  return (
    <input
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
