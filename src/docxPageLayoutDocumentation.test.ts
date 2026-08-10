import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryText = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const adrIndex = repositoryText('docs/adr/README.md');
const adr = repositoryText('docs/adr/0027-bounded-docx-page-layout.md');
const doctoring = repositoryText('docs/doctoring/docx-page-layout.md');

describe('DOCX page-layout documentation contract', () => {
  it('keeps the active decision discoverable without claiming protected-main maturity', () => {
    expect(adrIndex).toContain('[0027](0027-bounded-docx-page-layout.md)');
    expect(adrIndex).toContain('| Proposed | Bounded single-section page layout');
    expect(adr).toContain('Status: Proposed');
    expect(adr).toContain('`implemented_on_active_pr`');
    expect(adr).toContain('not protected-main behavior');
  });

  it('records the bounded schema and excluded authorities', () => {
    for (const term of [
      '`a4`',
      '`letter`',
      '`portrait`',
      '`landscape`',
      '`margins_mm`',
      '0 through 100',
      'single section',
    ]) {
      expect(adr).toContain(term);
    }
    expect(adr).toMatch(/no network access/iu);
    expect(adr).toMatch(/print-service authority/iu);
    expect(adr).toMatch(/atomic publication/iu);
  });

  it('anchors doctoring in primary library and OOXML sources with rollback guidance', () => {
    expect(doctoring).toContain('python-docx 1.2.0');
    expect(doctoring).toContain('ECMA-376');
    expect(doctoring).toContain('https://python-docx.readthedocs.io/');
    expect(doctoring).toContain('https://ecma-international.org/');
    expect(doctoring).toMatch(/APA 7 references/iu);
    expect(doctoring).toMatch(/rollback/iu);
  });
});
