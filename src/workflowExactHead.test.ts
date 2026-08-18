import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const workflow = repositoryFile('.github/workflows/ci.yml');
const releaseWorkflow = repositoryFile('.github/workflows/release.yml');

const CHECKOUT_PIN =
  'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1';
const PNPM_ACTION_SETUP_PIN =
  'pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6.0.10';
const VULNERABLE_PNPM_ACTION_SETUP_PIN =
  'pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093 # v6.0.8';
const SETUP_NODE_PIN =
  'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0';

describe('exact-head CI workflow contract', () => {
  it('uses a fixed runner and checks out the immutable current PR head', () => {
    expect(workflow).not.toContain('ubuntu-latest');
    expect(workflow.match(/runs-on: ubuntu-24\.04/g)).toHaveLength(3);
    expect(workflow.match(new RegExp(CHECKOUT_PIN, 'g'))).toHaveLength(3);
    expect(
      workflow.match(
        /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/g,
      ),
    ).toHaveLength(3);
    expect(workflow.match(/persist-credentials: false/g)).toHaveLength(3);
  });

  it('runs exact-head CI for pull requests regardless of stacked base branch', () => {
    expect(workflow).toContain('  push:\n    branches: [main]');
    expect(workflow).toContain('  pull_request:\n');
    expect(workflow).not.toContain('  pull_request:\n    branches: [main]');
  });

  it('keeps ordinary jobs bounded while allowing slow browser dependency mirrors to finish', () => {
    expect(workflow.match(/timeout-minutes: 30/g)).toHaveLength(2);
    expect(workflow.match(/timeout-minutes: 60/g)).toHaveLength(1);

    const browserStart = workflow.indexOf('  browser-release-evidence:');
    const officeStart = workflow.indexOf('  office:', browserStart);
    expect(browserStart).toBeGreaterThan(-1);
    expect(officeStart).toBeGreaterThan(browserStart);
    const browserJob = workflow.slice(browserStart, officeStart);
    expect(browserJob).toContain('timeout-minutes: 60');
  });

  it('verifies the runtime checkout SHA before any job consumes repository code', () => {
    const verificationStep = [
      '- name: Verify exact checkout',
      '        env:',
      '          INKSPAN_EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}',
      '        run: |',
      '          actual_head="$(git rev-parse HEAD)"',
      '          test "$actual_head" = "$INKSPAN_EXPECTED_HEAD_SHA"',
    ].join('\n');

    expect(workflow.split(verificationStep)).toHaveLength(4);
  });

  it('keeps the workflow read-only and hash-pins every third-party action', () => {
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).toContain(
      'env:\n  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true',
    );

    const usesLines = workflow
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- uses:'));
    expect(usesLines.length).toBeGreaterThan(0);
    for (const line of usesLines) {
      expect(line).toMatch(/@[0-9a-f]{40}(?:\s+#\s+v[^\s]+)?$/u);
    }
  });

  it('does not bootstrap pnpm through the vulnerable action release', () => {
    expect(workflow.match(new RegExp(PNPM_ACTION_SETUP_PIN, 'g'))).toHaveLength(2);
    expect(workflow).not.toContain(VULNERABLE_PNPM_ACTION_SETUP_PIN);
  });

  it('uses the current native-Node-24 setup-node release in every JavaScript job', () => {
    expect(workflow.match(new RegExp(SETUP_NODE_PIN, 'g'))).toHaveLength(2);
    expect(workflow).not.toContain(
      'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0',
    );
  });

  it('records the evidence boundary and unreleased hardening', () => {
    const doctoring = repositoryFile(
      'docs/doctoring/exact-head-ci-evidence.md',
    );
    const changelog = repositoryFile('CHANGELOG.md');

    expect(doctoring).toContain(
      '# Doctoring record: exact-head CI evidence',
    );
    expect(doctoring).toContain('synthetic pull-request merge ref');
    expect(doctoring).toContain('immutable contributor head');
    expect(doctoring).toContain('persist-credentials: false');
    expect(doctoring).toContain('not merge-result compatibility evidence');
    expect(changelog).toContain('exact-head read-only CI');
  });
});

describe('release workflow pnpm bootstrap contract', () => {
  it('uses the signed non-vulnerable pnpm action in every release JavaScript job', () => {
    expect(
      releaseWorkflow.match(new RegExp(PNPM_ACTION_SETUP_PIN, 'g')),
    ).toHaveLength(2);
    expect(releaseWorkflow).not.toContain(VULNERABLE_PNPM_ACTION_SETUP_PIN);
  });
});
