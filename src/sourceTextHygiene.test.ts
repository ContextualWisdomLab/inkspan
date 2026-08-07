import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const TEXT_HYGIENE_TARGETS = [
  ['root public entrypoint', 'src/index.ts'],
  ['revision-evidence entrypoint test', 'src/revision-evidence/index.test.ts'],
] as const;

describe('source text hygiene', () => {
  it.each(TEXT_HYGIENE_TARGETS)('%s ends with one line feed', (_label, relativePath) => {
    const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');

    expect(source.endsWith('\n')).toBe(true);
    expect(source.endsWith('\n\n')).toBe(false);
  });
});
