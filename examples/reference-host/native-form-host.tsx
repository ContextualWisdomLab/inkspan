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
  /**
   * Demonstration mode for the public controlled and uncontrolled editor APIs.
   * This changes only local React ownership of the current value; durable
   * persistence and authorization remain host-owned through onAuthorizedSubmit.
   */
  controlMode?: 'controlled' | 'uncontrolled';
  /**
   * Host-owned write permission presentation.
   *
   * A read-only host keeps the editor readable while fail-closing native form
   * submission/reset and disabling the named form field. This is presentation
   * evidence only; the embedding host remains responsible for authorization at
   * the durable write boundary.
   */
  readOnly?: boolean;
}

/**
 * Buyer-facing native-form integration example.
 *
 * Inkspan owns synchronization of the editor document into the native form
 * control. The host reads FormData at submit time and then applies its own
 * authorization and durable-persistence policy through onAuthorizedSubmit.
 * Both the public controlled and uncontrolled editor compositions are supported
 * without changing that boundary. Overlapping submissions and form resets are
 * blocked by the synchronous single-flight admission gate while the host
 * callback is in flight; React presentation state is not used as the mutation
 * authority. Host read-only state additionally fail-closes native form writes
 * and disables the named field without moving authorization authority into
 * Inkspan. A later successful reset returns the host presentation to an
 * explicitly unsaved state and restores the controlled example value when that
 * mode is selected.
 */
export function NativeFormHost({
  onAuthorizedSubmit,
  controlMode = 'uncontrolled',
  readOnly = false,
}: NativeFormHostProps) {
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>('idle');
  const [controlledValue, setControlledValue] = useState('# Draft');
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
    if (readOnly || submitAuthorized.isInFlight()) {
      return;
    }

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
    if (readOnly || submitAuthorized.isInFlight()) {
      event.preventDefault();
      return;
    }
    if (controlMode === 'controlled') {
      setControlledValue('# Draft');
    }
    setSubmissionState('idle');
  }

  return (
    <form onSubmit={handleSubmit} onReset={handleReset}>
      <CwlEditor
        mode="markdown"
        value={controlMode === 'controlled' ? controlledValue : undefined}
        onChange={controlMode === 'controlled' ? setControlledValue : undefined}
        defaultValue={controlMode === 'uncontrolled' ? '# Draft' : undefined}
        editable={!readOnly}
        formFieldName="message_body"
        formFieldDisabled={readOnly}
        formResetValue="# Draft"
      />
      <div>
        <button
          type="submit"
          disabled={readOnly || submissionState === 'saving'}
        >
          Save document
        </button>
        <button
          type="reset"
          disabled={readOnly || submissionState === 'saving'}
        >
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
