import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const hangulGuide = readFileSync('docs/HANGUL.md', 'utf8');
const hangulAdr = readFileSync(
  'docs/adr/0030-hangul-document-authoring-boundary.md',
  'utf8',
);

describe('Hangul compatibility documentation', () => {
  it('documents the structures exercised by the public round-trip contract', () => {
    expect(hangulGuide).toContain(
      '| Lists | Yes | Yes | Structural bullet and ordered lists; explicit start-number metadata is not modeled |',
    );
    expect(hangulGuide).toContain(
      '| Block quotes | Yes | Yes | Nested supported block content is preserved |',
    );
    expect(hangulGuide).toContain(
      '| Code blocks | Yes | Yes | Text content is preserved; language metadata is not modeled |',
    );
    expect(hangulGuide).toContain(
      '| Basic tables | Yes | Yes | Header/cell topology is preserved; spans and layout styling are not modeled |',
    );
    expect(hangulGuide).not.toContain('| Lists | Planned | Planned |');
    expect(hangulGuide).not.toContain('| Tables | Planned | Planned |');
    expect(hangulGuide).toContain(
      '| Shapes/charts/equations | Rejected | Rejected | Fail closed; no silent drop |',
    );
    expect(hangulGuide).toContain('src/hangul/fixtures/');
    expect(hangulGuide).toContain('briefing-minutes.section.xml');
    expect(hangulGuide).toContain('unsupported-shape.section.xml');
    expect(hangulGuide).toContain('fail closed');
    expect(hangulGuide).toContain(
      'open the exact source fixture and compare it against the committed expected paragraphs and tables',
    );
  });

  it('documents the capability metadata returned by the public import API', () => {
    expect(hangulGuide).toContain(
      '{ documentJson, sourceFormat, warnings, lossy, capabilities }',
    );
    expect(hangulGuide).toContain('`capabilities` object is frozen');
    expect(hangulGuide).toContain('`importFormats`');
    expect(hangulGuide).toContain('`exportFormats`');
    expect(hangulGuide).toContain('`recommendedExportFormat`');
    expect(hangulGuide).toContain('`supportedContent`');
  });

  it('documents the finite untrusted-engine traversal ceilings as Inkspan safety limits', () => {
    for (const document of [hangulGuide, hangulAdr]) {
      expect(document).toContain('4,096 sections');
      expect(document).toContain('1,000,000 paragraphs per section');
      expect(document).toContain('16,777,216 UTF-16 code units per paragraph');
      expect(document).toContain('Inkspan safety ceilings');
      expect(document).toContain('not HWP/HWPX format maxima');
    }
  });
});
