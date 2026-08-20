import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const baseline = readFileSync(
  resolve(process.cwd(), 'docs/product-technical-gap-baseline.md'),
  'utf8',
);

describe('product-technical gap snapshot consistency', () => {
  it('does not encode a self-invalidating exact head for its own active PR', () => {
    const selfRow = baseline
      .split('\n')
      .find((line) => line.includes('[PR #372]'));

    expect(selfRow).toBeDefined();
    expect(selfRow).toContain('head resolved live');
    expect(selfRow).not.toMatch(/exact head `[0-9a-f]{40}`/u);
  });
});
