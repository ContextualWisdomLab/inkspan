import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('protected headless Markdown documentation authority', () => {
  it('marks ADR 0020 and canonical package documentation as protected-main authority', () => {
    const architecture = repositoryFile('ARCHITECTURE.md');
    const trd = repositoryFile('docs/TRD.md');
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');
    const adrIndex = repositoryFile('docs/adr/README.md');
    const adr = repositoryFile(
      'docs/adr/0020-framework-neutral-markdown-package-boundary.md',
    );

    expect(architecture).toContain('Protected markdown subpath');
    expect(architecture).not.toContain('active PR #114');
    expect(trd).toContain(
      'framework-neutral deterministic Markdown package subpath is implemented on protected `main`',
    );
    expect(trd).not.toContain('active PR #114');
    expect(fitness).toMatch(
      /Framework-neutral Markdown package boundary[^\n]*implemented_on_protected_main/u,
    );
    expect(fitness).not.toMatch(
      /Framework-neutral Markdown package boundary[^\n]*implemented_on_active_pr/u,
    );
    expect(adrIndex).toMatch(
      /\[0020\]\(0020-framework-neutral-markdown-package-boundary\.md\) \| Accepted \|/u,
    );
    expect(adr).toContain('Status: Accepted');
    expect(adr).toContain('implemented on protected `main`');
    expect(adr).not.toContain('active PR #114');
  });
});
