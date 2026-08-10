import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('protected DOCX heading alignment documentation', () => {
  it('keeps the accepted heading-alignment decision discoverable', () => {
    const adrPath = 'docs/adr/0025-bounded-docx-heading-alignment.md';
    const index = repositoryFile('docs/adr/README.md');

    expect(existsSync(resolve(process.cwd(), adrPath))).toBe(true);
    const adr = repositoryFile(adrPath);
    expect(index).toContain(
      '[0025](0025-bounded-docx-heading-alignment.md) | Accepted',
    );
    expect(adr).toContain('Status: Accepted');
    for (const marker of ['left', 'center', 'right', 'justify']) {
      expect(adr).toContain(marker);
    }
    expect(adr).toContain('heading');
    expect(adr).toContain('Hosts own');
    expect(adr).toContain('## Rollback or supersession');
  });

  it('aligns buyer guidance, doctoring, traceability, and fitness with protected behavior', () => {
    const officeGuide = repositoryFile('office/README.md');
    const doctoringPath = 'docs/doctoring/docx-heading-alignment.md';
    const traceability = repositoryFile('docs/TRACEABILITY.md');
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');

    expect(existsSync(resolve(process.cwd(), doctoringPath))).toBe(true);
    const doctoring = repositoryFile(doctoringPath);
    for (const document of [officeGuide, doctoring]) {
      expect(document).toContain('heading');
      expect(document).toMatch(/left/iu);
      expect(document).toMatch(/center/iu);
      expect(document).toMatch(/right/iu);
      expect(document).toMatch(/justify/iu);
    }
    expect(doctoring).toContain('Microsoft. (n.d.).');
    expect(doctoring).toContain('python-docx. (n.d.).');
    expect(traceability).toMatch(/DOCX bounded heading alignment[^\n]*protected-main/iu);
    expect(fitness).toMatch(
      /DOCX bounded heading alignment[^\n]*implemented_on_protected_main/u,
    );
  });
});
