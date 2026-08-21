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

const workflow = repositoryFile('.github/workflows/release.yml');
const playwrightConfig = repositoryFile('tests/browser/playwright.config.ts');
const browserHarness = repositoryFile('tests/browser/harness.ts');
const browserEvidenceContract = repositoryFile('tests/browser/evidenceContract.ts');
const browserSpec = repositoryFile('tests/browser/specs/clipboard.browser.spec.ts');
const consensusSpec = repositoryFile('tests/browser/specs/clipboard.consensus.spec.ts');
const reviewSpec = repositoryFile('tests/browser/specs/review.browser.spec.ts');

describe('release cross-engine browser evidence contract', () => {
  it('requires the release tag commit to equal the current protected main tip', () => {
    const buildJob = workflowJob(
      workflow,
      'build-release-artifacts',
      'browser-release-evidence',
    );

    expect(buildJob).toContain(
      'git fetch --no-tags origin refs/heads/main:refs/remotes/origin/main',
    );
    expect(buildJob).toContain(
      'main_sha="$(git rev-parse refs/remotes/origin/main)"',
    );
    expect(buildJob).toContain('if [[ "$GITHUB_SHA" != "$main_sha" ]]; then');
    expect(buildJob).toContain(
      'Release tags must point to the current protected main tip.',
    );
    expect(buildJob).not.toContain(
      'git merge-base --is-ancestor "$GITHUB_SHA" refs/remotes/origin/main',
    );
  });

  it('tests the packed npm artifact built from the exact tagged source', () => {
    const buildJobIndex = workflow.indexOf('  build-release-artifacts:');
    const browserJobIndex = workflow.indexOf('  browser-release-evidence:');
    const publishJobIndex = workflow.indexOf('  publish-release:');

    expect(buildJobIndex).toBeGreaterThan(-1);
    expect(browserJobIndex).toBeGreaterThan(buildJobIndex);
    expect(publishJobIndex).toBeGreaterThan(browserJobIndex);

    const browserJob = workflowJob(
      workflow,
      'browser-release-evidence',
      'publish-release',
    );
    expect(browserJob).toContain('needs: build-release-artifacts');
    expect(browserJob).toContain('Cross-engine Clipboard / Playwright 1.62.0');
    expect(browserJob).toContain('runs-on: ubuntu-24.04');
    expect(browserJob).toContain('permissions:\n      contents: read');
    expect(browserJob).toContain(
      'uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1',
    );
    expect(browserJob).toContain('ref: ${{ github.sha }}');
    expect(browserJob).toContain('persist-credentials: false');
    expect(browserJob).toContain(
      'uses: actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7.0.0',
    );
    expect(browserJob).toContain('name: inkspan-release-${{ github.ref_name }}');
    expect(browserJob).toContain('path: release');
    expect(browserJob).toContain('sha256sum --check SHA256SUMS');
    expect(browserJob).toContain('Install exact packed editor artifact for browser verification');
    expect(browserJob).toContain('tests/browser/node_modules/@contextualwisdomlab/cwl-editor');
    expect(browserJob).toContain('INKSPAN_EXPECTED_PACKAGE_SHA256');
    expect(browserJob).toContain('pnpm --dir tests/browser install --frozen-lockfile');
    expect(browserJob).toContain(
      'pnpm --dir tests/browser exec playwright install --with-deps chromium firefox webkit',
    );
    expect(browserJob).toContain('INKSPAN_EXPECTED_HEAD_SHA: ${{ github.sha }}');
    expect(browserJob).toContain(
      'pnpm --dir tests/browser exec playwright test --config playwright.config.ts',
    );
  });

  it('retains only bounded browser evidence and fails if it was not produced', () => {
    const browserJob = workflowJob(
      workflow,
      'browser-release-evidence',
      'publish-release',
    );
    expect(browserJob).toContain(
      'uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1',
    );
    expect(browserJob).toContain('path: tests/browser/.browser-evidence/');
    expect(browserJob).toContain('include-hidden-files: true');
    expect(browserJob).toContain('if-no-files-found: error');
    expect(browserJob).toContain('if: always()');
    expect(browserJob).toContain('retention-days: 14');
    expect(browserJob).not.toContain('path: tests/browser/test-results');
  });

  it('binds browser evidence to one fresh run, current lock, and packed package bytes', () => {
    expect(playwrightConfig).toContain("globalSetup: './globalSetup.ts'");
    expect(playwrightConfig).toContain('clipboard|print|review');
    expect(browserHarness).toContain("from 'inkspan-browser-under-test'");
    expect(browserEvidenceContract).toContain("createReadStream(resolve(releaseDirectory");
    expect(browserEvidenceContract).toContain("entry.name.endsWith('.tgz')");
    expect(browserEvidenceContract).toContain("createHash('sha256')");
    expect(browserEvidenceContract).toContain(
      'Cross-engine release evidence requires exactly one packed npm artifact.',
    );
    expect(browserEvidenceContract).toContain(
      'Packed npm artifact digest does not match propagated release evidence.',
    );
    expect(browserSpec).toContain('runId');
    expect(browserSpec).toContain('packageSha256: await packedPackageSha256(repositoryRoot)');
    expect(consensusSpec).toContain("createHash('sha256')");
    expect(consensusSpec).toContain("'../pnpm-lock.yaml'");
    expect(consensusSpec).toContain('item.runId');
    expect(consensusSpec).toContain('reference.runId');
    expect(consensusSpec).toContain('item.lockSha256');
    expect(consensusSpec).toContain('currentLockSha256');
    expect(consensusSpec).toContain('currentPackageSha256');
    expect(consensusSpec).toContain('item.packageSha256');
    expect(consensusSpec).toContain('packedPackageSha256(repositoryRoot)');
    expect(reviewSpec).toContain('window.mountInkspanReviewProbe()');
    expect(reviewSpec).toContain("data-review-status', 'stale'");
    expect(reviewSpec).toContain("setViewportSize({ width: 360, height: 740 })");
    expect(reviewSpec).toContain("emulateMedia({ forcedColors: 'active' })");
    expect(reviewSpec).toContain("emulateMedia({ media: 'print' })");
  });

  it('makes immutable publication depend on both artifacts and tagged browser evidence', () => {
    const publishJobIndex = workflow.indexOf('  publish-release:');
    expect(publishJobIndex).toBeGreaterThan(-1);

    const publishJob = workflow.slice(publishJobIndex);
    expect(publishJob).toContain(
      'needs: [build-release-artifacts, browser-release-evidence]',
    );
  });
});
