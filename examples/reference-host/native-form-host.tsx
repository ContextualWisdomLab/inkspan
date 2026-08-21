import { useRef, useState, type FormEvent } from 'react';
import { CwlEditor } from '@contextualwisdomlab/cwl-editor';
import {
  createSingleFlightSubmission,
  type ReferenceHostSubmissionState,
} from './single-flight-submission.js';

type SubmissionState = 'idle' | ReferenceHostSubmissionState;

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
 * Overlapping submissions and form resets are blocked while the host callback
 * is in flight, preventing stale success presentation or duplicate durable
 * writes without claiming host persistence. A later successful reset returns
 * the host presentation to an explicitly unsaved state.
 */
export function NativeFormHost({
  onAuthorizedSubmit,
}: NativeFormHostProps) {
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>('idle');
  const onAuthorizedSubmitRef = useRef(onAuthorizedSubmit);
  onAuthorizedSubmitRef.current = onAuthorizedSubmit;

  const submitAuthorizedRef = useRef<
    ReturnType<typeof createSingleFlightSubmission> | null
  >(null);
  const existingSubmitAuthorized = submitAuthorizedRef.current;
  const submitAuthorized =
    existingSubmitAuthorized ??
    createSingleFlightSubmission(
      (messageBody) => onAuthorizedSubmitRef.current(messageBody),
      setSubmissionState,
    );
  if (existingSubmitAuthorized === null) {
    submitAuthorizedRef.current = submitAuthorized;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const messageBodyEntry = new FormData(event.currentTarget).get(
      'message_body',
    );
    if (typeof messageBodyEntry !== 'string') {
      setSubmissionState('failed');
      return;
    }

    await submitAuthorized(messageBodyEntry);
  }

  function handleReset(event: FormEvent<HTMLFormElement>) {
    if (submissionState === 'saving') {
      event.preventDefault();
      return;
    }
    setSubmissionState('idle');
  }

  return (
    <form onSubmit={handleSubmit} onReset={handleReset}>
      <CwlEditor
        mode="markdown"
        defaultValue="# Draft"
        formFieldName="message_body"
        formResetValue="# Draft"
      />
      <div>
        <button type="submit" disabled={submissionState === 'saving'}>
          Save document
        </button>
        <button type="reset" disabled={submissionState === 'saving'}>
          Reset draft
        </button>
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
