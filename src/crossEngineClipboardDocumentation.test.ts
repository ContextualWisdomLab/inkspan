import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const documentText = (path: string): string =>
  repositoryFile(path).replace(/\s+/gu, ' ').trim();

/** Return the unique Markdown table row containing the requested cell text. */
function tableRow(document: string, cellText: string): string {
  const matches = document
    .split(/\r?\n/u)
    .filter((line) => line.startsWith('|') && line.includes(cellText));
  expect(matches).toHaveLength(1);
  return matches[0] ?? '';
}

/** Return the unique changelog bullet containing the requested feature phrase. */
function changelogBullet(document: string, phrase: string): string {
  const matches = document
    .split(/\r?\n/u)
    .filter((line) => line.startsWith('- ') && line.includes(phrase));
  expect(matches).toHaveLength(1);
  return matches[0] ?? '';
}

describe('cross-engine clipboard documentation contract', () => {
  it('documents the exact browser release gate and evidence identity', () => {
    const guide = documentText('docs/clipboard-security.md');
    const doctoring = documentText(
      'docs/doctoring/cross-engine-rich-clipboard-assurance.md',
    );
    const strategy = documentText('docs/TEST_STRATEGY.md');

    for (const text of [guide, doctoring, strategy]) {
      expect(text).toContain('Chromium');
      expect(text).toContain('Firefox');
      expect(text).toContain('WebKit');
      expect(text).toContain('Playwright 1.62.0');
      expect(text).toContain('exact source head');
      expect(text).toContain('corpus version');
    }
    expect(doctoring).toContain('Chromium 151.0.7922.34');
    expect(doctoring).toContain('Firefox 153');
    expect(doctoring).toContain('WebKit 26.5');
    expect(doctoring).toContain('pnpm-lock.yaml');
  });

  it('keeps browser differences fail-closed and narrowly reviewable', () => {
    const doctoring = documentText(
      'docs/doctoring/cross-engine-rich-clipboard-assurance.md',
    );
    const operability = documentText('docs/OPERABILITY.md');

    for (const text of [doctoring, operability]) {
      expect(text).toContain('fail closed');
      expect(text).toContain('standards');
      expect(text).toContain('rollback');
    }
    expect(doctoring).toContain('no generic normalization');
    expect(doctoring).toContain('synthetic fixtures');
    expect(doctoring).toContain('no tenant document');
  });

  it('documents operator-verifiable packed artifact and retained evidence semantics', () => {
    const operability = documentText('docs/OPERABILITY.md');

    expect(operability).toContain('packed npm artifact');
    expect(operability).toContain('SHA-256');
    expect(operability).toContain('.browser-evidence');
    expect(operability).toContain('fresh run identity');
    expect(operability).toContain('Playwright screenshots');
    expect(operability).toContain('test-results');
  });

  it('records browser maturity in the exact canonical and changelog entries', () => {
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');
    const changelog = repositoryFile('CHANGELOG.md');
    const assuranceRow = tableRow(
      fitness,
      'Cross-engine browser-semantic release assurance',
    );
    const releaseBullet = changelogBullet(
      changelog,
      'cross-engine rich-clipboard release gate',
    );

    expect(assuranceRow).toContain('`implemented_on_active_pr`');
    expect(assuranceRow).toContain('SafeClipboard itself is `implemented_on_protected_main`');
    expect(assuranceRow).not.toContain('`implemented_on_protected_main`; SafeClipboard itself');
    expect(releaseBullet).toContain('dependency-locked Chromium/Firefox/WebKit');
    expect(releaseBullet).toContain('Playwright 1.62.0');
  });
});
