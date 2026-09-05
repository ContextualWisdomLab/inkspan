import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/delayed-proposal.mjs',
);

describe('reference-host delayed proposal application failure', () => {
  it('redacts host apply failures instead of leaking private causes through the proposal boundary', () => {
    const fixtureUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { applyDelayedProposal, createDelayedProposal } from ${fixtureUrl};
      const privateCause = 'private host apply cause';
      const proposal = await createDelayedProposal({
        expectedRevision: 'revision-v1',
        replacement: 'Accepted proposal',
      });
      let error = null;
      try {
        applyDelayedProposal({
          proposal,
          currentRevision: 'revision-v1',
          apply() {
            throw new Error(privateCause);
          },
        });
      } catch (failure) {
        error = failure instanceof Error ? failure.message : 'unexpected error';
      }
      process.stdout.write(JSON.stringify({
        error,
        leakedPrivateCause: typeof error === 'string' && error.includes(privateCause),
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      error: 'proposal application failed.',
      leakedPrivateCause: false,
    });
  });

  it('does not report applied when a host apply thenable rejects asynchronously', () => {
    const fixtureUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { applyDelayedProposal, createDelayedProposal } from ${fixtureUrl};
      const privateCause = 'private async host apply cause';
      const proposal = await createDelayedProposal({
        expectedRevision: 'revision-v1',
        replacement: 'Accepted proposal',
      });
      let error = null;
      let status = null;
      try {
        const result = await applyDelayedProposal({
          proposal,
          currentRevision: 'revision-v1',
          apply() {
            return {
              then(_resolve, reject) {
                reject(new Error(privateCause));
              },
            };
          },
        });
        status = result.status;
      } catch (failure) {
        error = failure instanceof Error ? failure.message : 'unexpected error';
      }
      process.stdout.write(JSON.stringify({
        error,
        leakedPrivateCause: typeof error === 'string' && error.includes(privateCause),
        status,
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      error: 'proposal application failed.',
      leakedPrivateCause: false,
      status: null,
    });
  });
});
