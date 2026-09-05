import { describe, expect, it, vi } from 'vitest';

import {
  createSingleFlightSubmission,
  shouldBlockReferenceHostFormMutation,
} from '../examples/reference-host/single-flight-submission.js';

describe('reference-host native-form synchronous admission', () => {
  it('blocks a same-turn reset after durable submission admission before presentation commits', async () => {
    let releaseAuthorizedSubmit: (() => void) | undefined;
    const authorizedSubmit = new Promise<void>((resolve) => {
      releaseAuthorizedSubmit = resolve;
    });
    let savingPresentationCommitted = false;
    const submit = createSingleFlightSubmission(
      async () => authorizedSubmit,
      (state) => {
        if (state === 'saving') {
          queueMicrotask(() => {
            savingPresentationCommitted = true;
          });
        }
      },
    );

    expect(
      shouldBlockReferenceHostFormMutation(false, submit.isInFlight),
    ).toBe(false);

    const pendingSubmission = submit('# Durable write');

    expect(submit.isInFlight()).toBe(true);
    expect(savingPresentationCommitted).toBe(false);

    const preventDefault = vi.fn();
    if (shouldBlockReferenceHostFormMutation(false, submit.isInFlight)) {
      preventDefault();
    }

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(savingPresentationCommitted).toBe(false);

    await Promise.resolve();
    expect(savingPresentationCommitted).toBe(true);

    releaseAuthorizedSubmit?.();
    await expect(pendingSubmission).resolves.toBe(true);
    expect(submit.isInFlight()).toBe(false);
  });

  it('also blocks host writes while read-only without consulting presentation state', () => {
    expect(shouldBlockReferenceHostFormMutation(true, () => false)).toBe(true);
  });
});
