import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const workflowPath = resolve(
  repositoryRoot,
  '.github/workflows/performance-evidence.yml',
);

describe('performance evidence workflow contract', () => {
  it('runs a bounded exact-head packed-artifact benchmark on performance-relevant PRs', () => {
    expect(existsSync(workflowPath)).toBe(true);
    if (!existsSync(workflowPath)) return;

    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('name: Performance Evidence');
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toContain('runs-on: ubuntu-24.04');
    expect(workflow).toContain('timeout-minutes: 20');
    expect(workflow).toContain(
      'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
    );
    expect(workflow).toContain(
      'ref: ${{ github.event.pull_request.head.sha }}',
    );
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('Verify exact checkout');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).toContain('pnpm build');
    expect(workflow).toContain('pnpm pack --pack-destination');
    expect(workflow).toContain('node benchmarks/generate-corpus.mjs');
    expect(workflow).toContain('node benchmarks/run-current-suite.mjs');
    expect(workflow).toContain('--profile small');
    expect(workflow).toContain('--samples 3');
    expect(workflow).toContain(
      '--reference-hardware-id github-actions-ubuntu-24.04-x64',
    );
    expect(workflow).toContain(
      'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
    );
    expect(workflow).toContain('retention-days: 5');
    expect(workflow).not.toContain('secrets.');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('pull-requests: write');
  });
});
