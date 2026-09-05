export type ReferenceHostSubmissionState = 'saving' | 'saved' | 'failed';

export type AuthorizedSubmit = (
  messageBody: string,
) => Promise<void> | void;

export type SubmissionStateObserver = (
  state: ReferenceHostSubmissionState,
) => void;

/**
 * Return whether a reference-host native-form write must be rejected now.
 *
 * Read-only host policy and the synchronous durable-submission admission gate
 * are the only authority inputs. Presentation state is deliberately excluded so
 * a submit/reset event in the same turn cannot race a deferred React commit.
 */
export function shouldBlockReferenceHostFormMutation(
  readOnly: boolean,
  isDurableSubmissionInFlight: () => boolean,
): boolean {
  return readOnly || isDurableSubmissionInFlight();
}

/**
 * Serialize host-owned authorized persistence attempts without assuming any
 * transport or storage authority in Inkspan.
 *
 * Overlapping attempts are rejected while one host callback is in flight.
 * The returned callable also exposes the synchronous admission gate so event
 * handlers can reject same-turn mutations without depending on deferred UI
 * state. Host failures are reduced to a stable boolean/state signal so private
 * durable-store details do not cross the reference component boundary.
 * Presentation-state observer failures are best-effort and cannot block,
 * reclassify, or wedge the host-owned persistence attempt.
 */
export function createSingleFlightSubmission(
  onAuthorizedSubmit: AuthorizedSubmit,
  onStateChange: SubmissionStateObserver,
) {
  let inFlight = false;

  const notifyState = (state: ReferenceHostSubmissionState) => {
    try {
      onStateChange(state);
    } catch {
      // Presentation observation must not acquire persistence authority.
    }
  };

  const submit = async (messageBody: string): Promise<boolean> => {
    if (inFlight) {
      return false;
    }

    inFlight = true;
    notifyState('saving');
    try {
      await onAuthorizedSubmit(messageBody);
      notifyState('saved');
      return true;
    } catch {
      notifyState('failed');
      return false;
    } finally {
      inFlight = false;
    }
  };

  return Object.assign(submit, {
    isInFlight: (): boolean => inFlight,
  });
}
