import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

/** Extract one top-level workflow job without allowing another job to satisfy it. */
function workflowJob(source: string, jobName: string, nextJobName: string): string {
  const start = source.indexOf(`  ${jobName}:`);
  const end = source.indexOf(`  ${nextJobName}:`, start + 1);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

/** Extract one named workflow step so unrelated steps cannot satisfy its contract. */
function workflowStep(source: string, stepName: string, nextStepName: string): string {
  const start = source.indexOf(`      - name: ${stepName}`);
  const end = source.indexOf(`      - name: ${nextStepName}`, start + 1);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('release artifact checkout authority', () => {
  it('binds the artifact build to the exact tag SHA without persisted credentials before setup', () => {
    const workflow = repositoryFile('.github/workflows/release.yml');
    const buildJob = workflowJob(
      workflow,
      'build-release-artifacts',
      'browser-release-evidence',
    );
    const checkoutStep = workflowStep(
      buildJob,
      'Check out the tagged source',
      'Verify exact checkout',
    );
    const verifyStep = workflowStep(
      buildJob,
      'Verify exact checkout',
      'Set up pnpm',
    );

    expect(checkoutStep).toContain('uses: actions/checkout@');
    expect(checkoutStep).toContain('with:');
    expect(checkoutStep).toContain('ref: ${{ github.sha }}');
    expect(checkoutStep).toContain('fetch-depth: 0');
    expect(checkoutStep).toContain('persist-credentials: false');
    expect(verifyStep).toContain('INKSPAN_EXPECTED_HEAD_SHA: ${{ github.sha }}');
    expect(verifyStep).toContain('actual_head="$(git rev-parse HEAD)"');
    expect(verifyStep).toContain(
      'test "$actual_head" = "$INKSPAN_EXPECTED_HEAD_SHA"',
    );

    expect(buildJob.indexOf('name: Verify exact checkout')).toBeLessThan(
      buildJob.indexOf('name: Set up pnpm'),
    );
    expect(buildJob.indexOf('name: Verify exact checkout')).toBeLessThan(
      buildJob.indexOf('name: Set up Node.js'),
    );
    expect(buildJob.indexOf('name: Verify exact checkout')).toBeLessThan(
      buildJob.indexOf('name: Set up Python'),
    );
  });

  it('preserves the established prerelease tag semantics while npm publication remains gated', () => {
    const workflow = repositoryFile('.github/workflows/release.yml');
    const buildJob = workflowJob(
      workflow,
      'build-release-artifacts',
      'browser-release-evidence',
    );
    const identityStep = workflowStep(
      buildJob,
      'Verify release identity and current main tip',
      'Install JavaScript dependencies',
    );

    expect(identityStep).toContain(
      "if (!/^v(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?$/.test(releaseTag))",
    );
    expect(identityStep).toContain('Release tag is not valid semantic version syntax');
    expect(identityStep).not.toContain('valid stable semantic version syntax');
    expect(workflow).toContain(
      "github.repository == 'ContextualWisdomLab/inkspan' && !contains(github.ref_name, '-')",
    );
  });
});
