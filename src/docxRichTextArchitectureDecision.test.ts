import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const normalizeWhitespace = (text: string): string => text.replace(/\s+/gu, ' ');

const expectRichParagraphContract = (document: string): void => {
  const normalized = normalizeWhitespace(document);

  expect(normalized).toMatch(/rich_paragraph/iu);
  expect(normalized).toMatch(/runs.{0,80}4,096 entries/iu);
  expect(normalized).toMatch(/(?:run|runs).{0,80}non-empty.{0,40}(?:string )?`?text`?/iu);
  expect(normalized).toMatch(/bold.{0,120}italic.{0,120}underline/iu);
  expect(normalized).toMatch(/hosts?.{0,160}(?:authoring|responsib)/iu);
};

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
    expectRichParagraphContract(adr);
  });

  it('keeps the protected Office guide and APA-7 doctoring aligned', () => {
    const officeGuide = repositoryFile('office/README.md');
    const doctoring = repositoryFile('docs/doctoring/docx-rich-text-runs.md');

    for (const document of [officeGuide, doctoring]) {
      expectRichParagraphContract(document);
    }

    expect(doctoring).toContain('Microsoft. (2024, January 12).');
    expect(doctoring).toContain('python-docx. (n.d.).');
    expect(doctoring).toContain('Retrieved August 10, 2026');
  });
});
