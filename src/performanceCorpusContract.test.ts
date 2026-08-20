import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface BenchmarkProfileLock {
  readonly sections: number;
  readonly bytes: number;
  readonly sha256: string;
}

interface BenchmarkCorpusLock {
  readonly contractVersion: 1;
  readonly synthetic: true;
  readonly scripts: readonly [
    'English',
    'Korean',
    'Japanese',
    'Chinese',
    'Vietnamese',
    'mixed',
  ];
  readonly profiles: Readonly<
    Record<'small' | 'medium' | 'large' | 'stress', BenchmarkProfileLock>
  >;
}

function runGenerator(outputDirectory: string): BenchmarkCorpusLock {
  const script = resolve(process.cwd(), 'benchmarks/generate-corpus.mjs');
  execFileSync(process.execPath, [script, '--output', outputDirectory], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(
    readFileSync(join(outputDirectory, 'manifest.json'), 'utf8'),
  ) as BenchmarkCorpusLock;
}

describe('deterministic synthetic performance corpus', () => {
  it('reproduces the committed corpus lock exactly across independent runs', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-corpus-'));
    const first = join(root, 'first');
    const second = join(root, 'second');
    try {
      const expected = JSON.parse(
        readFileSync(
          resolve(process.cwd(), 'benchmarks/corpus.lock.json'),
          'utf8',
        ),
      ) as BenchmarkCorpusLock;
      const firstManifest = runGenerator(first);
      const secondManifest = runGenerator(second);

      expect(firstManifest).toEqual(expected);
      expect(secondManifest).toEqual(expected);
      expect(firstManifest.synthetic).toBe(true);
      expect(firstManifest.scripts).toEqual([
        'English',
        'Korean',
        'Japanese',
        'Chinese',
        'Vietnamese',
        'mixed',
      ]);

      for (const profile of ['small', 'medium', 'large', 'stress'] as const) {
        const firstBytes = readFileSync(join(first, `${profile}.md`));
        const secondBytes = readFileSync(join(second, `${profile}.md`));
        expect(firstBytes.equals(secondBytes)).toBe(true);
        expect(firstBytes.byteLength).toBe(expected.profiles[profile].bytes);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
