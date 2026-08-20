import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('protected DOCX hyperlink documentation maturity', () => {
  it('keeps the technical requirements aligned with accepted protected ADR 0026', () => {
    const trd = repositoryFile('docs/TRD.md');
    const adr = repositoryFile(
      'docs/adr/0026-bounded-docx-external-hyperlinks.md',
    );

    expect(adr).toContain('Status: Accepted');
    expect(adr).toContain('implemented on protected `main` through PR #137');
    expect(trd).toContain(
      'Protected `main` implements Accepted ADR 0026 through integrated PR #137',
    );
    expect(trd).toContain(
      'bounded DOCX rich-run external hyperlinks, and the OIDC-backed unified stable registry release train are `implemented_on_protected_main`',
    );
    expect(trd).not.toContain(
      'Active PR #137 implements the Proposed ADR 0026 extension',
    );
    expect(trd).not.toContain(
      'The bounded DOCX rich-run external hyperlink contract in #137 is `implemented_on_active_pr` under Proposed ADR 0026',
    );
  });
});
