import { useState, type FormEvent } from 'react';
import { CwlEditor } from '@contextualwisdomlab/cwl-editor';

type SubmissionState = 'idle' | 'saving' | 'saved' | 'failed';

export interface NativeFormHostProps {
  /**
   * Host-owned authorization and durable persistence boundary.
   * The reference component deliberately does not choose transport,
   * credentials, tenancy, or storage for the embedding application.
   */
  onAuthorizedSubmit(messageBody: string): Promise<void> | void;
}

/**
 * Buyer-facing native-form integration example.
 *
 * Inkspan owns synchronization of the editor document into the native form
 * control. The host reads FormData at submit time and then applies its own
 * authorization and durable-persistence policy through onAuthorizedSubmit.
 */
export function NativeFormHost({
  onAuthorizedSubmit,
}: NativeFormHostProps) {
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const messageBodyEntry = new FormData(event.currentTarget).get(
      'message_body',
    );
    if (typeof messageBodyEntry !== 'string') {
      setSubmissionState('failed');
      return;
    }

    setSubmissionState('saving');
    try {
      const messageBody = messageBodyEntry;
      await onAuthorizedSubmit(messageBody);
      setSubmissionState('saved');
    } catch {
      setSubmissionState('failed');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <CwlEditor
        mode="markdown"
        defaultValue="# Draft"
        formFieldName="message_body"
        formResetValue="# Draft"
      />
      <div>
        <button type="submit">Save document</button>
        <button type="reset">Reset draft</button>
      </div>
      <output aria-live="polite">
        {submissionState === 'saving'
          ? 'Saving…'
          : submissionState === 'saved'
            ? 'Saved'
            : submissionState === 'failed'
              ? 'Save failed'
              : 'Not saved yet'}
      </output>
    </form>
  );
}
