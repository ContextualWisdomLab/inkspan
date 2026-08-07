import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEXT_HYGIENE_TARGETS = [
  ['root public entrypoint', new URL('./index.ts', import.meta.url)],
  [
    'revision-evidence entrypoint test',
    new URL('./revision-evidence/index.test.ts', import.meta.url),
  ],
] as const;

describe('source text hygiene', () => {
  it.each(TEXT_HYGIENE_TARGETS)('%s ends with one line feed', (_label, sourceUrl) => {
    const source = readFileSync(fileURLToPath(sourceUrl), 'utf8');

    expect(source.endsWith('\n')).toBe(true);
    expect(source.endsWith('\n\n')).toBe(false);
  });
});
