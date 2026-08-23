import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const verifierPath = resolve(
  repositoryRoot,
  'examples/reference-host/verify-current-reference-journey.mjs',
);

describe('reference-host one-command journey contract', () => {
  it('exposes one deterministic command for the currently implemented buyer journey', () => {
    expect(existsSync(verifierPath)).toBe(true);

    const output = execFileSync(process.execPath, [verifierPath, '--plan'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    });

    expect(JSON.parse(output.trim())).toEqual({
      command:
        'node examples/reference-host/verify-current-reference-journey.mjs',
      contractVersion: 1,
      status: 'plan',
      steps: [
        {
          args: ['--self-test'],
          path: 'examples/reference-host/synthetic-document-repository.mjs',
        },
        {
          args: ['--self-test'],
          path: 'examples/reference-host/delayed-proposal.mjs',
        },
        {
          args: ['--self-test'],
          path: 'examples/reference-host/autosave-view-model.mjs',
        },
        {
          args: ['--self-test'],
          path: 'examples/reference-host/collaboration-provider-lifecycle.mjs',
        },
        {
          args: [],
          path: 'examples/reference-host/verify-packed-artifact.mjs',
        },
        {
          args: [],
          path: 'examples/reference-host/verify-office-handoff.mjs',
        },
      ],
    });
  });
});
