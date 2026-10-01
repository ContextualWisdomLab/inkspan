import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const TEXT_HYGIENE_TARGETS = [
  ['root public entrypoint', 'src/index.ts'],
  ['revision-evidence entrypoint test', 'src/revision-evidence/index.test.ts'],
  ['revision-evidence build config', 'vite.revision-evidence.config.ts'],
] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('source text hygiene', () => {
  it.each(TEXT_HYGIENE_TARGETS)('%s ends with one line feed', (_label, relativePath) => {
    const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');

    expect(source.endsWith('\n')).toBe(true);
    expect(source.endsWith('\n\n')).toBe(false);
  });

  it('preserves V8 coverage ignore hints through esbuild', () => {
    const unpreservedHints = sourceFiles(resolve(process.cwd(), 'src')).flatMap(
      (path) => readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.includes('/* v8 ignore') && !line.includes('@preserve'))
        .map((line) => `${path}: ${line.trim()}`),
    );

    expect(unpreservedHints).toEqual([]);
  });
});
