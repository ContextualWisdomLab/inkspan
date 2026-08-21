export type ReferenceHostSubmissionState = 'saving' | 'saved' | 'failed';

export type AuthorizedSubmit = (
  messageBody: string,
) => Promise<void> | void;

export type SubmissionStateObserver = (
  state: ReferenceHostSubmissionState,
) => void;

/**
 * Serialize host-owned authorized persistence attempts without assuming any
 * transport or storage authority in Inkspan.
 *
 * Overlapping attempts are rejected while one host callback is in flight.
 * Host failures are reduced to a stable boolean/state signal so private
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

  return async (messageBody: string): Promise<boolean> => {
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
}
