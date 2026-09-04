import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const workflow = repositoryFile('.github/workflows/ci.yml');
const releaseWorkflow = repositoryFile('.github/workflows/release.yml');
const diagnosticsWorkflow = repositoryFile(
  '.github/workflows/writing-diagnostics-assurance-tdd.yml',
);
const editorActionsWorkflow = repositoryFile(
  '.github/workflows/writing-diagnostics-editor-actions-tdd.yml',
);
const collaborationWorkflow = repositoryFile(
  '.github/workflows/writing-diagnostics-collaboration-tdd.yml',
);

const CHECKOUT_PIN =
  'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1';
const SETUP_NODE_PIN =
  'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0';
const ACTIONS_CACHE_PIN =
  'actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0';
const PNPM_ACTION_SETUP_PIN =
  'pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6.0.10';
const VULNERABLE_PNPM_ACTION_SETUP_PIN =
  'pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093 # v6.0.8';
const SETUP_PYTHON_PIN =
  'actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5.6.0';
const EXPECTED_HEAD_REF =
  'ref: ${{ github.event.pull_request.head.sha || github.sha }}';
const VERIFY_EXACT_CHECKOUT_STEP = [
  '- name: Verify exact checkout',
  '        env:',
  '          INKSPAN_EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}',
  '        run: |',
  '          actual_head="$(git rev-parse HEAD)"',
  '          test "$actual_head" = "$INKSPAN_EXPECTED_HEAD_SHA"',
].join('\n');

/** Return one top-level workflow job without borrowing assertions from siblings. */
function workflowJob(source: string, name: string, nextName?: string): string {
  const startMarker = `  ${name}:\n`;
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  if (nextName === undefined) {
    return source.slice(start);
  }
  const end = source.indexOf(`\n  ${nextName}:\n`, start + startMarker.length);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

/** Require checkout -> exact-SHA verification -> first consumer in one job. */
function expectExactCheckoutBeforeConsumer(job: string, consumer: string): void {
  const checkout = job.indexOf(`- uses: ${CHECKOUT_PIN}`);
  const verification = job.indexOf(VERIFY_EXACT_CHECKOUT_STEP);
  const consumerIndex = job.indexOf(consumer);

  expect(checkout).toBeGreaterThan(-1);
  expect(verification).toBeGreaterThan(checkout);
  expect(consumerIndex).toBeGreaterThan(verification);
  expect(job.match(new RegExp(CHECKOUT_PIN, 'g'))).toHaveLength(1);
  expect(job.match(new RegExp(EXPECTED_HEAD_REF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
  expect(job.match(/persist-credentials: false/g)).toHaveLength(1);
  expect(job.split(VERIFY_EXACT_CHECKOUT_STEP)).toHaveLength(2);

  const checkoutStep = job.slice(checkout, verification);
  expect(checkoutStep).not.toContain('\n      - ');
}

const buildJob = workflowJob(workflow, 'build-and-test', 'browser-release-evidence');
const browserJob = workflowJob(workflow, 'browser-release-evidence', 'office');
const officeJob = workflowJob(workflow, 'office');

describe('exact-head CI workflow contract', () => {
  it('cancels only superseded runs for the same repository and PR while keeping full main compatibility coverage', () => {
    expect(workflow).toContain(
      "group: ${{ github.workflow }}-${{ github.repository }}-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain('cancel-in-progress: true');
    expect(officeJob).toContain(
      "python-version: ${{ github.event_name == 'pull_request' && fromJSON('[\"3.14\"]') || fromJSON('[\"3.11\", \"3.12\", \"3.13\", \"3.14\"]') }}",
    );
    expect(releaseWorkflow).toContain(
      'group: ${{ github.workflow }}-${{ github.repository }}-${{ github.ref_name }}',
    );
    expect(releaseWorkflow).toContain('cancel-in-progress: false');
  });

  it('uses a fixed runner and checks out the immutable current PR head in every job', () => {
    expect(workflow).not.toContain('ubuntu-latest');
    for (const job of [buildJob, browserJob, officeJob]) {
      expect(job.match(/runs-on: ubuntu-24\.04/g)).toHaveLength(1);
      expect(job).toContain(`- uses: ${CHECKOUT_PIN}`);
      expect(job).toContain(EXPECTED_HEAD_REF);
      expect(job).toContain('persist-credentials: false');
    }
  });

  it('runs exact-head CI for pull requests regardless of stacked base branch', () => {
    const triggerStart = workflow.indexOf('on:\n');
    const triggerEnd = workflow.indexOf('\npermissions:', triggerStart);
    expect(triggerStart).toBeGreaterThan(-1);
    expect(triggerEnd).toBeGreaterThan(triggerStart);
    const triggerBlock = workflow.slice(triggerStart, triggerEnd);

    expect(triggerBlock).toContain('  push:\n    branches: [main]');
    const pullRequestLines = triggerBlock
      .split('\n')
      .filter((line) => line.startsWith('  pull_request:'));
    expect(pullRequestLines).toEqual(['  pull_request:']);
    expect(triggerBlock).not.toMatch(/  pull_request:\n(?:    .*\n)*?    branches:/u);
  });

  it('binds timeout policy to the intended job instead of global counts', () => {
    expect(buildJob.match(/timeout-minutes:/g)).toHaveLength(1);
    expect(buildJob).toContain('timeout-minutes: 30');
    expect(browserJob.match(/timeout-minutes:/g)).toHaveLength(1);
    expect(browserJob).toContain('timeout-minutes: 60');
    expect(officeJob.match(/timeout-minutes:/g)).toHaveLength(1);
    expect(officeJob).toContain('timeout-minutes: 30');
  });

  it('verifies each runtime checkout immediately before repository-consuming setup', () => {
    expectExactCheckoutBeforeConsumer(
      buildJob,
      `- uses: ${PNPM_ACTION_SETUP_PIN}`,
    );
    expectExactCheckoutBeforeConsumer(
      browserJob,
      `- uses: ${PNPM_ACTION_SETUP_PIN}`,
    );
    expectExactCheckoutBeforeConsumer(
      officeJob,
      `- uses: ${SETUP_PYTHON_PIN}`,
    );
  });

  it('checks diagnostics assurance out at the immutable contributor head', () => {
    const exactHeadRef =
      'ref: ${{ github.event.pull_request.head.sha || github.sha }}';
    const exactExpectedHead =
      'INKSPAN_EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}';

    expect(diagnosticsWorkflow.split(exactHeadRef)).toHaveLength(3);
    expect(diagnosticsWorkflow).not.toContain('ref: ${{ github.sha }}');
    expect(diagnosticsWorkflow).toContain(exactExpectedHead);
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
    expect(buildJob).toContain(PNPM_ACTION_SETUP_PIN);
    expect(browserJob).toContain(PNPM_ACTION_SETUP_PIN);
    expect(officeJob).not.toContain(PNPM_ACTION_SETUP_PIN);
    expect(workflow).not.toContain(VULNERABLE_PNPM_ACTION_SETUP_PIN);
  });

  it('uses the current native-Node-24 setup-node release in every JavaScript job', () => {
    expect(buildJob).toContain(SETUP_NODE_PIN);
    expect(browserJob).toContain(SETUP_NODE_PIN);
    expect(officeJob).not.toContain(SETUP_NODE_PIN);
    expect(workflow).not.toContain(
      'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0',
    );
  });

  it('rejects the vulnerable pnpm action bootstrap in release jobs', () => {
    expect(releaseWorkflow).not.toContain(VULNERABLE_PNPM_ACTION_SETUP_PIN);
    expect(
      releaseWorkflow.match(new RegExp(PNPM_ACTION_SETUP_PIN, 'g')),
    ).toHaveLength(2);
  });

  it('caches exact Playwright revisions while retaining system dependency setup', () => {
    expect(diagnosticsWorkflow).toContain(ACTIONS_CACHE_PIN);
    expect(diagnosticsWorkflow).toContain(
      'path: /tmp/inkspan-playwright-browsers',
    );
    expect(diagnosticsWorkflow).toContain(
      `${'${{ runner.os }}'}-playwright-${'${{ runner.arch }}'}-${'${{ hashFiles(\'tests/browser/pnpm-lock.yaml\') }}'}`,
    );
    expect(diagnosticsWorkflow).toContain(
      'playwright install --with-deps chromium firefox webkit',
    );
  });

  it('makes editor-action assurance fail closed on React act warnings', () => {
    expect(editorActionsWorkflow).toContain(PNPM_ACTION_SETUP_PIN);
    expect(editorActionsWorkflow).not.toContain(VULNERABLE_PNPM_ACTION_SETUP_PIN);
    expect(editorActionsWorkflow.match(/not wrapped in act/g)).toHaveLength(2);
    expect(
      editorActionsWorkflow.match(/test_status=\$\{PIPESTATUS\[0\]\}/g),
    ).toHaveLength(2);
    expect(editorActionsWorkflow).toContain(
      '::error::Focused editor actions emitted a React act warning.',
    );
    expect(editorActionsWorkflow).toContain(
      '::error::Production coverage emitted a React act warning.',
    );
  });

  it('makes collaboration assurance fail closed on React act warnings', () => {
    expect(collaborationWorkflow).toContain(PNPM_ACTION_SETUP_PIN);
    expect(collaborationWorkflow).not.toContain(
      VULNERABLE_PNPM_ACTION_SETUP_PIN,
    );
    expect(
      collaborationWorkflow.match(/not wrapped in act/g),
    ).toHaveLength(2);
    expect(
      collaborationWorkflow.match(/test_status=\$\{PIPESTATUS\[0\]\}/g),
    ).toHaveLength(2);
    expect(collaborationWorkflow).toContain(
      '::error::Focused collaborative diagnostics emitted a React act warning.',
    );
    expect(collaborationWorkflow).toContain(
      '::error::Production coverage emitted a React act warning.',
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
