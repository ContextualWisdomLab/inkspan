import { describe, expect, it, vi } from 'vitest';
import { createSingleFlightSubmission } from '../examples/reference-host/single-flight-submission.js';

describe('reference-host authorized submission single-flight boundary', () => {
  it('admits at most one durable host submission at a time and permits a later submission after settlement', async () => {
    let resolveFirst: (() => void) | undefined;
    const firstResult = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const onAuthorizedSubmit = vi
      .fn<(messageBody: string) => Promise<void>>()
      .mockImplementationOnce(async () => firstResult)
      .mockResolvedValue(undefined);
    const states: string[] = [];
    const submit = createSingleFlightSubmission(onAuthorizedSubmit, (state) => {
      states.push(state);
    });

    const first = submit('# First');
    const overlapping = submit('# Overlapping');

    expect(onAuthorizedSubmit).toHaveBeenCalledTimes(1);
    expect(onAuthorizedSubmit).toHaveBeenLastCalledWith('# First');
    await expect(overlapping).resolves.toBe(false);
    expect(states).toEqual(['saving']);

    resolveFirst?.();
    await expect(first).resolves.toBe(true);
    expect(states).toEqual(['saving', 'saved']);

    await expect(submit('# Later')).resolves.toBe(true);
    expect(onAuthorizedSubmit).toHaveBeenCalledTimes(2);
    expect(onAuthorizedSubmit).toHaveBeenLastCalledWith('# Later');
    expect(states).toEqual(['saving', 'saved', 'saving', 'saved']);
  });

  it('releases the gate after a failed host submission without exposing the failure value', async () => {
    const privateFailure = new Error('private durable-store detail');
    const onAuthorizedSubmit = vi
      .fn<(messageBody: string) => Promise<void>>()
      .mockRejectedValueOnce(privateFailure)
      .mockResolvedValue(undefined);
    const states: string[] = [];
    const submit = createSingleFlightSubmission(onAuthorizedSubmit, (state) => {
      states.push(state);
    });

    await expect(submit('# Failing')).resolves.toBe(false);
    await expect(submit('# Retry')).resolves.toBe(true);

    expect(onAuthorizedSubmit).toHaveBeenCalledTimes(2);
    expect(states).toEqual(['saving', 'failed', 'saving', 'saved']);
  });
});
