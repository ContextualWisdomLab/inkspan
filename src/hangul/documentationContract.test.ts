import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const hangulGuide = readFileSync(
  new URL('../../docs/HANGUL.md', import.meta.url),
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
  });
});
