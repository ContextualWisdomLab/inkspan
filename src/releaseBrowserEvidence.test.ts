import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const workflow = repositoryFile('.github/workflows/release.yml');

describe('release cross-engine browser evidence contract', () => {
  it('re-runs the pinned three-engine clipboard gate on the exact tagged source', () => {
    const browserJobIndex = workflow.indexOf('  browser-release-evidence:');
    const buildJobIndex = workflow.indexOf('  build-release-artifacts:');

    expect(browserJobIndex).toBeGreaterThan(-1);
    expect(buildJobIndex).toBeGreaterThan(browserJobIndex);

    const browserJob = workflow.slice(browserJobIndex, buildJobIndex);
    expect(browserJob).toContain('Cross-engine Clipboard / Playwright 1.62.0');
    expect(browserJob).toContain('runs-on: ubuntu-24.04');
    expect(browserJob).toContain('permissions:\n      contents: read');
    expect(browserJob).toContain('persist-credentials: false');
    expect(browserJob).toContain('pnpm --dir tests/browser install --frozen-lockfile');
    expect(browserJob).toContain(
      'pnpm --dir tests/browser exec playwright install --with-deps chromium firefox webkit',
    );
    expect(browserJob).toContain('INKSPAN_EXPECTED_HEAD_SHA: ${{ github.sha }}');
    expect(browserJob).toContain(
      'pnpm --dir tests/browser exec playwright test --config playwright.config.ts',
    );
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
