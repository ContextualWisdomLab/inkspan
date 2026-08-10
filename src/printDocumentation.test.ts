import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const normalize = (value: string): string => value.replace(/\s+/gu, ' ').trim();

describe('browser print documentation authority', () => {
  it('indexes one explicit browser print contract without expanding product authority', () => {
    const index = repositoryFile('docs/README.md');
    const contract = normalize(repositoryFile('docs/print-output.md'));

    expect(index).toContain('[`print-output.md`](print-output.md)');
    expect(contract).toContain('Status: Implemented on active PR');
    expect(contract).toContain('@media print');
    expect(contract).toContain('print-to-PDF');
    expect(contract).toContain('collaboration');
    expect(contract).toContain('placeholder');
    expect(contract).toContain('host');
    expect(contract).not.toMatch(/Inkspan[^.]{0,80}(?:signs|persists) exported/iu);
  });

  it('records normative and draft W3C inputs with APA-style maturity', () => {
    const doctoring = repositoryFile(
      'docs/doctoring/browser-print-paged-media.md',
    );

    expect(doctoring).toContain('World Wide Web Consortium. (2024, May 21).');
    expect(doctoring).toContain('*Media Queries Level 3* (W3C Recommendation).');
    expect(doctoring).toContain('World Wide Web Consortium. (2018, December 4).');
    expect(doctoring).toContain('(Candidate Recommendation).');
    expect(doctoring).toContain('World Wide Web Consortium. (2023, September 14).');
    expect(doctoring).toContain('(Working Draft).');
    expect(doctoring).toContain('https://www.w3.org/TR/mediaqueries-3/');
    expect(doctoring).toContain('https://www.w3.org/TR/css-break-3/');
    expect(doctoring).toContain('https://www.w3.org/TR/css-page-3/');
  });

  it('keeps paged-output claims semantic rather than byte-identical', () => {
    const contract = normalize(repositoryFile('docs/print-output.md'));
    const doctoring = normalize(
      repositoryFile('docs/doctoring/browser-print-paged-media.md'),
    );

    for (const document of [contract, doctoring]) {
      expect(document).toMatch(/browser/iu);
      expect(document).toMatch(/fragment/iu);
      expect(document).toMatch(/not|does not/iu);
    }
    expect(contract).toContain('not a promise that every browser/printer combination will produce byte-identical pagination');
    expect(doctoring).toContain('semantic rather than pixel- or byte-identical');
  });
});
