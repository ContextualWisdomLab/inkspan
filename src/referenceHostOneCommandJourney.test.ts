import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const verifierPath = resolve(
  repositoryRoot,
  'examples/reference-host/verify-current-reference-journey.mjs',
);
const browserVerifierPath = resolve(
  repositoryRoot,
  'examples/reference-host/verify-browser-journey.mjs',
);
const packedOfficeVerifierPath = resolve(
  repositoryRoot,
  'examples/reference-host/verify-packed-office-journey.mjs',
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
          args: ['--self-test'],
          path: 'examples/reference-host/verify-packed-office-journey.mjs',
        },
        {
          args: ['--self-test'],
          path: 'examples/reference-host/verify-browser-journey.mjs',
        },
      ],
    });
  });

  it('binds the scoped Office step to a self-contained exact packed tarball', () => {
    expect(existsSync(packedOfficeVerifierPath)).toBe(true);

    const output = execFileSync(
      process.execPath,
      [packedOfficeVerifierPath, '--plan'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10_000,
      },
    );

    expect(JSON.parse(output.trim())).toEqual({
      command:
        'node examples/reference-host/verify-packed-office-journey.mjs',
      contractVersion: 1,
      packageAuthority: 'exact-packed-tarball',
      status: 'plan',
    });
  });

  it('binds the scoped browser step to an exact packed tarball and all supported engines', () => {
    expect(existsSync(browserVerifierPath)).toBe(true);

    const output = execFileSync(
      process.execPath,
      [browserVerifierPath, '--plan'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10_000,
      },
    );

    expect(JSON.parse(output.trim())).toEqual({
      command: 'node examples/reference-host/verify-browser-journey.mjs',
      contractVersion: 1,
      packageAuthority: 'exact-packed-tarball',
      projects: ['chromium', 'firefox', 'webkit'],
      specs: [
        'reference-host-dirty-state.browser.spec.ts',
        'reference-host-forced-colors.print.browser.spec.ts',
        'reference-host-hydration.browser.spec.ts',
        'reference-host-readonly.browser.spec.ts',
        'reference-host.print.browser.spec.ts',
      ],
      status: 'plan',
    });
  });
});
