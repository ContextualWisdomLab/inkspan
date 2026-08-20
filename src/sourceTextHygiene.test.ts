import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const TEXT_HYGIENE_TARGETS = [
  ['root public entrypoint', 'src/index.ts'],
  ['revision-evidence entrypoint test', 'src/revision-evidence/index.test.ts'],
  ['revision-evidence build config', 'vite.revision-evidence.config.ts'],
  ['review contract', 'src/review/contract.ts'],
  ['review entrypoint', 'src/review/index.ts'],
  ['review build config', 'vite.review.config.ts'],
  ['review panel fixture', 'src/components/ReviewPanel.fixture.tsx'],
] as const;

describe('source text hygiene', () => {
  it.each(TEXT_HYGIENE_TARGETS)('%s ends with one line feed', (_label, relativePath) => {
    const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');

    expect(source.endsWith('\n')).toBe(true);
    expect(source.endsWith('\n\n')).toBe(false);
  });
});
