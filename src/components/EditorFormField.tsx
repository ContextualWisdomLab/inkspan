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

/** Mirror the current serialized document into a native hidden form field. */
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
  const [serializedValue, setSerializedValue] = useState('');

  useEffect(() => {
    if (!editor || name === undefined) {
      serializedValueRef.current = '';
      setSerializedValue('');
      return;
    }

    const synchronizeValue = () => {
      const nextValue = editorHtmlToValue(editor.getHTML(), mode);
      serializedValueRef.current = nextValue;
      setSerializedValue(nextValue);
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
    let observingReset = true;

    const handleReset = (event: Event) => {
      console.log('[reset-trace] reset event received');
      if (event.target !== field.form) return;
      console.log('[reset-trace] reset target accepted');
      queueMicrotask(() => {
        console.log('[reset-trace] reset microtask entered');
        if (!observingReset || event.defaultPrevented) return;
        if (name !== undefined) field.value = serializedValueRef.current;
        console.log('[reset-trace] before editor callback');
        onFormReset(event);
        console.log('[reset-trace] after editor callback');
      });
    };

    eventRoot.addEventListener('reset', handleReset);
    return () => {
      observingReset = false;
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
