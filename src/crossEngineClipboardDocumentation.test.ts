import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const documentText = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\s+/gu, ' ').trim();

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

  it('records the current implementation maturity without calling the active PR shipped', () => {
    const fitness = documentText('docs/DOCUMENTATION_FITNESS.md');
    const changelog = documentText('CHANGELOG.md');

    expect(fitness).toContain(
      'Cross-engine browser-semantic release assurance',
    );
    expect(fitness).toContain('`implemented_on_active_pr`');
    expect(fitness).toContain('SafeClipboard');
    expect(fitness).toContain('`implemented_on_protected_main`');
    expect(changelog).toContain('dependency-locked Chromium/Firefox/WebKit');
    expect(changelog).toContain('cross-engine rich-clipboard release gate');
  });
});
