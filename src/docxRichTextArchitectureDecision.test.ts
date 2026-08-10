import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('protected DOCX bounded rich-text architecture decision', () => {
  it('keeps the accepted decision discoverable from the canonical ADR index', () => {
    const adrPath = 'docs/adr/0023-bounded-docx-rich-text-runs.md';
    const index = repositoryFile('docs/adr/README.md');
    const adr = repositoryFile(adrPath);

    expect(existsSync(resolve(process.cwd(), adrPath))).toBe(true);
    expect(index).toContain(
      '[0023](0023-bounded-docx-rich-text-runs.md) | Accepted',
    );
    expect(adr).toContain('Status: Accepted');
    expect(adr).toContain('4,096');
    expect(adr).toContain('bold');
    expect(adr).toContain('italic');
    expect(adr).toContain('underline');
    expect(adr).toContain('Hosts own authoring policy');
  });

  it('keeps the protected Office guide and APA-7 doctoring aligned', () => {
    const officeGuide = repositoryFile('office/README.md');
    const doctoring = repositoryFile('docs/doctoring/docx-rich-text-runs.md');

    for (const document of [officeGuide, doctoring]) {
      expect(document).toContain('rich_paragraph');
      expect(document).toContain('4,096');
      expect(document).toMatch(/bold/iu);
      expect(document).toMatch(/italic/iu);
      expect(document).toMatch(/underline/iu);
      expect(document).toMatch(/host/iu);
    }

    expect(doctoring).toContain('Microsoft. (2024, January 12).');
    expect(doctoring).toContain('python-docx. (n.d.).');
    expect(doctoring).toContain('Retrieved August 10, 2026');
  });
});
