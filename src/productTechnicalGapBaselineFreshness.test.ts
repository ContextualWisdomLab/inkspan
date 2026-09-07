import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readCanonicalDocument = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const baseline = (): string =>
  readCanonicalDocument('docs/product-technical-gap-baseline.md');

const canonicalIndex = (): string => readCanonicalDocument('docs/README.md');

describe('product-technical gap baseline freshness contract', () => {
  it('keeps mutable GitHub lifecycle state out of protected static truth', () => {
    const document = baseline();

    expect(document).toContain('Mutable GitHub state is intentionally not embedded');
    expect(document).not.toMatch(
      /\bprotected(?:\s+source)?\s+`?main`?\s*@\s*[0-9a-f]{40}\b/iu,
    );
    expect(document).not.toMatch(
      /\bPR\s+#\d+[\s\S]{0,120}\b(?:draft|ready(?:\s+for\s+review)?|active|exact\s+head)\b/iu,
    );
  });

  it('requires lifecycle decisions to refetch exact live evidence', () => {
    const document = baseline();

    expect(document).toMatch(
      /Before any merge, release, readiness, closure, or ownership decision,\s+refetch at\s+least:/u,
    );
    expect(document).not.toMatch(/\b(?:do not|don't|never)\s+refetch\b/iu);

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

  it('keeps the canonical index aligned with static-baseline and live-refetch semantics', () => {
    const index = canonicalIndex();

    expect(index).toContain(
      'Dated protected-main product/technical gap baseline and durable maintenance priorities; lifecycle decisions require decision-time live refetch rather than static PR/check snapshots',
    );
    expect(index).not.toContain(
      'Dated protected-main product/technical gap register, live PR lanes, release blockers, and executable maintenance loop',
    );
  });
});
