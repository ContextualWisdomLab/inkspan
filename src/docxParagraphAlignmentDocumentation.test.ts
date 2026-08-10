import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('protected DOCX paragraph alignment documentation', () => {
  it('keeps the accepted decision discoverable from the canonical ADR index', () => {
    const adrPath = 'docs/adr/0024-bounded-docx-paragraph-alignment.md';
    const index = repositoryFile('docs/adr/README.md');

    expect(existsSync(resolve(process.cwd(), adrPath))).toBe(true);
    const adr = repositoryFile(adrPath);
    expect(index).toContain(
      '[0024](0024-bounded-docx-paragraph-alignment.md) | Accepted',
    );
    expect(adr).toContain('Status: Accepted');
    expect(adr).toContain('left');
    expect(adr).toContain('center');
    expect(adr).toContain('right');
    expect(adr).toContain('justify');
    expect(adr).toContain('Hosts own');
  });

  it('keeps the Office guide and APA-7 doctoring aligned with protected behavior', () => {
    const officeGuide = repositoryFile('office/README.md');
    const doctoring = repositoryFile(
      'docs/doctoring/docx-paragraph-alignment.md',
    );

    for (const document of [officeGuide, doctoring]) {
      expect(document).toContain('alignment');
      expect(document).toMatch(/left/iu);
      expect(document).toMatch(/center/iu);
      expect(document).toMatch(/right/iu);
      expect(document).toMatch(/justify/iu);
      expect(document).toMatch(/paragraph|rich_paragraph/iu);
    }

    expect(doctoring).toContain('Microsoft. (n.d.).');
    expect(doctoring).toContain('python-docx. (n.d.).');
  });
});
