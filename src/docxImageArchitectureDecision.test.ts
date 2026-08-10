import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('protected DOCX informative PNG architecture decision', () => {
  it('keeps the accepted decision discoverable from the canonical ADR index', () => {
    const adrPath = 'docs/adr/0022-informative-docx-png-figures.md';
    const index = repositoryFile('docs/adr/README.md');
    const adr = repositoryFile(adrPath);

    expect(existsSync(resolve(process.cwd(), adrPath))).toBe(true);
    expect(index).toContain('[0022](0022-informative-docx-png-figures.md) | Accepted');
    expect(adr).toContain('Status: Accepted');
    expect(adr).toContain('data:image/png;base64,...');
    expect(adr).toContain('wp:docPr/@descr');
    expect(adr).toContain('decorative-image semantics are unsupported');
    expect(adr).toContain('Hosts own export authorization');
  });

  it('keeps the protected product contract and APA-7 doctoring aligned', () => {
    const officeGuide = repositoryFile('office/README.md');
    const doctoring = repositoryFile(
      'docs/doctoring/docx-inline-png-figures.md',
    );

    for (const document of [officeGuide, doctoring]) {
      expect(document).toContain('data:image/png;base64');
      expect(document).toMatch(/alternative|alt_text|descr/iu);
      expect(document).toMatch(/decorative/iu);
      expect(document).toMatch(/host/iu);
    }

    expect(doctoring).toContain('Masinter, L. (1998).');
    expect(doctoring).toContain('python-docx. (n.d.).');
    expect(doctoring).toContain('Microsoft. (n.d.).');
  });
});
