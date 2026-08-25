import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const baseline = (): string =>
  readFileSync(
    resolve(process.cwd(), 'docs/product-technical-gap-baseline.md'),
    'utf8',
  );

describe('product-technical gap baseline freshness contract', () => {
  it('keeps mutable GitHub lifecycle state out of protected static truth', () => {
    const document = baseline();

    expect(document).toContain('Mutable GitHub state is intentionally not embedded');
    expect(document).not.toMatch(/Protected source[^\n]*main@[0-9a-f]{40}/u);
    expect(document).not.toMatch(/PR #[0-9]+[^\n]*(?:Ready active|Draft|exact head)/u);
  });

  it('requires lifecycle decisions to refetch exact live evidence', () => {
    const document = baseline();

    for (const marker of [
      'protected `main`',
      'open pull requests',
      'open issues',
      'formal reviews',
      'unresolved review threads',
      'workflow jobs and checkout SHAs',
      'rulesets',
      'releases',
    ]) {
      expect(document).toContain(marker);
    }

    expect(document).toContain('Pending, queued, skipped, cancelled, absent, neutral, failed');
  });
});
