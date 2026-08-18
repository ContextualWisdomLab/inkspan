import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('active-PR spreadsheet body-import documentation', () => {
  it('keeps ADR 0032 Proposed and discoverable without promoting it to protected main', () => {
    const adrPath = 'docs/adr/0032-bounded-local-spreadsheet-body-import.md';
    const index = repositoryFile('docs/adr/README.md');
    const changelog = repositoryFile('CHANGELOG.md');
    const distribution = repositoryFile('docs/package-distribution.md');
    const contracts = repositoryFile('docs/CONTRACTS.md');
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');
    const unreleased = changelog.slice(
      changelog.indexOf('## [Unreleased]'),
      changelog.indexOf('## [0.6.0]'),
    );

    expect(existsSync(resolve(process.cwd(), adrPath))).toBe(true);
    const adr = repositoryFile(adrPath);
    expect(index).toContain(
      '[0032](0032-bounded-local-spreadsheet-body-import.md) | Proposed',
    );
    expect(adr).toMatch(/^Status: Proposed$/mu);
    expect(adr).not.toMatch(/^Status: Accepted$/mu);
    expect(adr).toContain('not protected-main implementation authority');
    expect(unreleased).toContain('Active PR / Proposed');
    expect(unreleased).toContain('local XLS/XLSX worksheet insertion');
    expect(unreleased).toContain('not protected-main behavior');
    expect(distribution).toMatch(
      /`@contextualwisdomlab\/cwl-editor\/spreadsheet`\s*\|\s*`implemented_on_active_pr`/u,
    );
    expect(distribution).not.toMatch(
      /`@contextualwisdomlab\/cwl-editor\/spreadsheet`[^\n]*implemented_on_protected_main/u,
    );
    expect(contracts).toContain('Local spreadsheet body-import contract');
    expect(contracts).toContain('not protected-main authority');
    expect(fitness).toMatch(
      /Bounded local spreadsheet body import[^\n]*implemented_on_active_pr/u,
    );
    expect(fitness).not.toMatch(
      /Bounded local spreadsheet body import[^\n]*implemented_on_protected_main/u,
    );
  });
});
