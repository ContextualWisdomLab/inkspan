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

describe('release artifact checkout authority', () => {
  it('binds the artifact build to the exact tag SHA without persisted credentials before setup', () => {
    const workflow = repositoryFile('.github/workflows/release.yml');
    const buildJob = workflowJob(
      workflow,
      'build-release-artifacts',
      'browser-release-evidence',
    );

    const checkoutIndex = buildJob.indexOf('name: Check out the tagged source');
    const verifyIndex = buildJob.indexOf('name: Verify exact checkout');
    const pnpmIndex = buildJob.indexOf('name: Set up pnpm');
    const nodeIndex = buildJob.indexOf('name: Set up Node.js');
    const pythonIndex = buildJob.indexOf('name: Set up Python');

    expect(checkoutIndex).toBeGreaterThan(-1);
    expect(buildJob).toContain('ref: ${{ github.sha }}');
    expect(buildJob).toContain('persist-credentials: false');
    expect(verifyIndex).toBeGreaterThan(checkoutIndex);
    expect(verifyIndex).toBeLessThan(pnpmIndex);
    expect(verifyIndex).toBeLessThan(nodeIndex);
    expect(verifyIndex).toBeLessThan(pythonIndex);
    expect(buildJob).toContain('INKSPAN_EXPECTED_HEAD_SHA: ${{ github.sha }}');
    expect(buildJob).toContain('actual_head="$(git rev-parse HEAD)"');
    expect(buildJob).toContain('test "$actual_head" = "$INKSPAN_EXPECTED_HEAD_SHA"');
  });
});
