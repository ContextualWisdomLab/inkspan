import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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

      const smallBody = readFileSync(join(first, 'small.md'), 'utf8');
      expect(smallBody).toContain(
        'Mixed-script: Inkspan review 검증은 日本語と中文 그리고 Tiếng Việt를 한 문단에서 deterministic하게 다룹니다.',
      );
      for (const dimensions of ['1x1', '16x16', '64x64']) {
        expect(smallBody).toContain(`![synthetic raster ${dimensions} 0001](`);
      }
      expect(
        new Set(smallBody.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g)).size,
      ).toBe(3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed instead of following a corpus output symlink', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-corpus-symlink-'));
    const outputDirectory = join(root, 'output');
    const victimPath = join(root, 'victim.md');
    try {
      mkdirSync(outputDirectory, { recursive: true });
      writeFileSync(victimPath, 'buyer-owned evidence\n', 'utf8');
      symlinkSync(victimPath, join(outputDirectory, 'small.md'));

      expect(() => runGenerator(outputDirectory)).toThrow();
      expect(readFileSync(victimPath, 'utf8')).toBe('buyer-owned evidence\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
