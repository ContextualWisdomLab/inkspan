import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const detailedAdrFiles = (): string[] =>
  readdirSync(resolve(process.cwd(), 'docs/adr'))
    .filter((name) => /^\d{4}-.+\.md$/u.test(name))
    .sort();

const requiredAdrHeadings = [
  /^## Context(?:\b|\s|$)/mu,
  /^## Alternatives considered(?:\b|\s|$)/mu,
  /^## Decision(?:\b|\s|$)/mu,
  /^## Consequences(?:\b|\s|$)/mu,
  /^## Failure and recovery(?:\b|\s|$)/mu,
  /^## Security and privacy impact(?:\b|\s|$)/mu,
  /^## Compatibility and migration(?:\b|\s|$)/mu,
  /^## Verification(?:\b|\s|$)/mu,
  /^## Rollback or supersession(?:\b|\s|$)/mu,
] as const;

describe('ADR quality documentation contract', () => {
  it('preserves the canonical ADR quality requirements on every reconciliation branch', () => {
    const adrIndex = repositoryFile('docs/adr/README.md');

    expect(adrIndex).toContain('## ADR quality requirements');
    expect(adrIndex).toContain('context and the problem boundary');
    expect(adrIndex).toContain('materially distinct alternatives considered');
    expect(adrIndex).toContain('failure and recovery semantics');
    expect(adrIndex).toContain('security and privacy impact');
    expect(adrIndex).toContain('compatibility and migration behavior');
    expect(adrIndex).toContain('verification/acceptance evidence');
    expect(adrIndex).toContain('rollback or explicit supersession conditions');
  });

  it('applies the canonical quality sections to every detailed ADR', () => {
    const adrFiles = detailedAdrFiles();

    expect(adrFiles.length).toBeGreaterThan(0);

    for (const adrFile of adrFiles) {
      const adr = repositoryFile(`docs/adr/${adrFile}`);

      for (const heading of requiredAdrHeadings) {
        expect(adr, `${adrFile} is missing ${heading.source}`).toMatch(heading);
      }
    }
  });

  it('indexes every detailed ADR exactly once under its filename identity', () => {
    const adrIndex = repositoryFile('docs/adr/README.md');
    const adrFiles = detailedAdrFiles();
    const identifiers = adrFiles.map((name) => name.slice(0, 4));

    expect(new Set(identifiers).size).toBe(identifiers.length);

    for (const adrFile of adrFiles) {
      const identifier = adrFile.slice(0, 4);
      const link = `[${identifier}](${adrFile})`;
      expect(
        adrIndex.split(link).length - 1,
        `${adrFile} must have exactly one canonical index row`,
      ).toBe(1);
    }
  });
});
