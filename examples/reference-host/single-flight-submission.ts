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
 */
export function createSingleFlightSubmission(
  onAuthorizedSubmit: AuthorizedSubmit,
  onStateChange: SubmissionStateObserver,
) {
  let inFlight = false;

  return async (messageBody: string): Promise<boolean> => {
    if (inFlight) {
      return false;
    }

    inFlight = true;
    onStateChange('saving');
    try {
      await onAuthorizedSubmit(messageBody);
      onStateChange('saved');
      return true;
    } catch {
      onStateChange('failed');
      return false;
    } finally {
      inFlight = false;
    }
  };
}
