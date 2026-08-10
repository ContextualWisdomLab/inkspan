import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

/** Return one top-level release workflow job body without trusting other jobs. */
function workflowJob(workflow: string, jobName: string, nextJobName?: string): string {
  const start = workflow.indexOf(`  ${jobName}:`);
  expect(start).toBeGreaterThan(-1);
  if (!nextJobName) return workflow.slice(start);
  const end = workflow.indexOf(`  ${nextJobName}:`, start + 1);
  expect(end).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

describe('OIDC registry trusted-publishing release contract', () => {
  const workflow = repositoryFile('.github/workflows/release.yml');

  it('publishes the exact validated npm tarball through a least-privilege OIDC job', () => {
    const npmJob = workflowJob(workflow, 'publish-npm', 'publish-pypi');

    expect(npmJob).toContain('needs: [publish-release]');
    expect(npmJob).toContain('runs-on: ubuntu-24.04');
    expect(npmJob).toContain('environment: npm');
    expect(npmJob).toContain('contents: read');
    expect(npmJob).toContain('id-token: write');
    expect(npmJob).toContain("node-version: '24'");
    expect(npmJob).toContain("!contains(github.ref_name, '-')");
    expect(npmJob).toContain('package/package.json');
    expect(npmJob).toContain('npm package version must match stable release version');
    expect(npmJob).toContain('npm publish "$npm_asset" --access public');
    expect(npmJob).toContain('npm version must be at least 11.5.1');
    expect(npmJob).not.toContain('NODE_AUTH_TOKEN');
    expect(npmJob).not.toContain('NPM_TOKEN');
    expect(npmJob).not.toContain('--provenance=false');
  });

  it('publishes only the validated matching-version Office wheel through the immutable official PyPA action', () => {
    const pypiJob = workflowJob(workflow, 'publish-pypi');

    expect(pypiJob).toContain('needs: [publish-release]');
    expect(pypiJob).toContain('runs-on: ubuntu-24.04');
    expect(pypiJob).toContain('environment: pypi');
    expect(pypiJob).toContain('contents: read');
    expect(pypiJob).toContain('id-token: write');
    expect(pypiJob).toContain("!contains(github.ref_name, '-')");
    expect(pypiJob).toContain('METADATA');
    expect(pypiJob).toContain('Office package version must match stable release version');
    expect(pypiJob).toContain(
      'pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33',
    );
    expect(pypiJob).toContain('packages-dir: pypi-release/');
    expect(pypiJob).not.toMatch(/(?:password|username|user):\s*\$\{\{\s*secrets\./u);
    expect(pypiJob).not.toMatch(/skip-existing:\s*true/u);
  });

  it('keeps OIDC authority out of build and workflow-global permissions', () => {
    const jobsIndex = workflow.indexOf('\njobs:');
    expect(jobsIndex).toBeGreaterThan(-1);
    const globalWorkflow = workflow.slice(0, jobsIndex);
    const buildJob = workflowJob(workflow, 'build-release-artifacts', 'browser-release-evidence');

    expect(globalWorkflow).toContain('permissions:\n  contents: read');
    expect(globalWorkflow).not.toContain('id-token: write');
    expect(buildJob).not.toContain('id-token: write');
  });

  it('records external trust prerequisites and non-atomic registry recovery', () => {
    const doctoring = repositoryFile('docs/doctoring/registry-trusted-publishing.md');
    const adr = repositoryFile('docs/adr/0019-unified-release-version-train.md');

    expect(doctoring).toContain('@contextualwisdomlab/cwl-editor');
    expect(doctoring).toContain('inkspan-office');
    expect(doctoring).toContain('release.yml');
    expect(doctoring).toContain('environment `npm`');
    expect(doctoring).toContain('environment `pypi`');
    expect(doctoring).toContain('npm CLI 11.5.1');
    expect(doctoring).toContain('Node 22.14.0');
    expect(doctoring).toContain('non-atomic');
    expect(doctoring).toContain('corrective release');
    expect(doctoring).toContain('one release version train');
    expect(adr).toContain('Status: Proposed');
    expect(adr).toContain('Unified npm and Office release version train');
    expect(adr).toContain('GitHub Release path');
    expect(doctoring).not.toMatch(/long-lived (?:npm|PyPI) (?:write )?token required/iu);
  });
});
