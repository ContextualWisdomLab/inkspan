import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface OfficeFixtureProfileLock {
  readonly pages: number;
  readonly blocks: number;
  readonly bytes: number;
  readonly sha256: string;
}

interface OfficeFixtureLock {
  readonly contractVersion: 1;
  readonly synthetic: true;
  readonly format: 'docx';
  readonly profiles: Readonly<
    Record<'small' | 'page120', OfficeFixtureProfileLock>
  >;
}

function runGenerator(outputDirectory: string): OfficeFixtureLock {
  const script = resolve(process.cwd(), 'benchmarks/generate-office-fixtures.mjs');
  execFileSync(process.execPath, [script, '--output', outputDirectory], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(
    readFileSync(join(outputDirectory, 'manifest.json'), 'utf8'),
  ) as OfficeFixtureLock;
}

describe('deterministic synthetic Office performance fixtures', () => {
  it('reproduces a schema-shaped DOCX corpus including a 120-page fixture', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-office-benchmark-'));
    const first = join(root, 'first');
    const second = join(root, 'second');
    try {
      const expected = JSON.parse(
        readFileSync(
          resolve(process.cwd(), 'benchmarks/office-fixtures.lock.json'),
          'utf8',
        ),
      ) as OfficeFixtureLock;
      const firstManifest = runGenerator(first);
      const secondManifest = runGenerator(second);

      expect(firstManifest).toEqual(expected);
      expect(secondManifest).toEqual(expected);
      expect(firstManifest).toEqual({
        contractVersion: 1,
        synthetic: true,
        format: 'docx',
        profiles: expected.profiles,
      });

      for (const profile of ['small', 'page120'] as const) {
        const firstBytes = readFileSync(join(first, `${profile}.json`));
        const secondBytes = readFileSync(join(second, `${profile}.json`));
        expect(firstBytes.equals(secondBytes)).toBe(true);
        expect(firstBytes.byteLength).toBe(expected.profiles[profile].bytes);
      }

      const page120 = JSON.parse(
        readFileSync(join(first, 'page120.json'), 'utf8'),
      ) as {
        format: string;
        blocks: Array<{ type: string; text?: string }>;
      };
      expect(page120.format).toBe('docx');
      expect(page120.blocks.filter(({ type }) => type === 'heading')).toHaveLength(120);
      expect(page120.blocks.filter(({ type }) => type === 'page_break')).toHaveLength(119);
      expect(page120.blocks.some(({ text }) => text?.includes('한국어'))).toBe(true);
      expect(page120.blocks.some(({ text }) => text?.includes('日本語'))).toBe(true);
      expect(page120.blocks.some(({ text }) => text?.includes('中文'))).toBe(true);
      expect(page120.blocks.some(({ text }) => text?.includes('Tiếng Việt'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
