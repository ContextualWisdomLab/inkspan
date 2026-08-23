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

interface OfficeFixtureProfileLock {
  readonly units: number;
  readonly bytes: number;
  readonly sha256: string;
}

interface OfficeFixtureLock {
  readonly contractVersion: 1;
  readonly synthetic: true;
  readonly formats: Readonly<{
    docx: Readonly<
      Record<'small' | 'page120', OfficeFixtureProfileLock>
    >;
    xlsx: Readonly<
      Record<'small' | 'wide16384', OfficeFixtureProfileLock>
    >;
    pptx: Readonly<
      Record<'small' | 'slide120', OfficeFixtureProfileLock>
    >;
  }>;
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

function expectDeterministicFixture(
  first: string,
  second: string,
  fileName: string,
  expectedBytes: number,
): void {
  const firstBytes = readFileSync(join(first, fileName));
  const secondBytes = readFileSync(join(second, fileName));
  expect(firstBytes.equals(secondBytes)).toBe(true);
  expect(firstBytes.byteLength).toBe(expectedBytes);
}

describe('deterministic synthetic Office performance fixtures', () => {
  it('reproduces bounded DOCX, XLSX, and PPTX corpora including 100+ unit fixtures', () => {
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
        formats: expected.formats,
      });

      for (const profile of ['small', 'page120'] as const) {
        expectDeterministicFixture(
          first,
          second,
          `docx-${profile}.json`,
          expected.formats.docx[profile].bytes,
        );
      }
      for (const profile of ['small', 'wide16384'] as const) {
        expectDeterministicFixture(
          first,
          second,
          `xlsx-${profile}.json`,
          expected.formats.xlsx[profile].bytes,
        );
      }
      for (const profile of ['small', 'slide120'] as const) {
        expectDeterministicFixture(
          first,
          second,
          `pptx-${profile}.json`,
          expected.formats.pptx[profile].bytes,
        );
      }

      const page120 = JSON.parse(
        readFileSync(join(first, 'docx-page120.json'), 'utf8'),
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

      const wide = JSON.parse(
        readFileSync(join(first, 'xlsx-wide16384.json'), 'utf8'),
      ) as {
        format: string;
        sheets: Array<{ rows: unknown[][]; freeze_panes?: string }>;
      };
      expect(wide.format).toBe('xlsx');
      expect(wide.sheets).toHaveLength(1);
      expect(wide.sheets[0]?.rows[0]).toHaveLength(16_384);
      expect(wide.sheets[0]?.freeze_panes).toBe('XFD1048576');

      const slide120 = JSON.parse(
        readFileSync(join(first, 'pptx-slide120.json'), 'utf8'),
      ) as {
        format: string;
        slides: Array<{ title: string; bullets?: Array<string | { text: string }> }>;
      };
      expect(slide120.format).toBe('pptx');
      expect(slide120.slides).toHaveLength(120);
      expect(slide120.slides.some(({ title }) => title.includes('한국어'))).toBe(true);
      expect(
        slide120.slides.some(({ bullets }) =>
          bullets?.some((bullet) =>
            typeof bullet === 'string'
              ? bullet.includes('日本語')
              : bullet.text.includes('日本語'),
          ),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed instead of overwriting a file through an Office fixture output symlink', () => {
    if (process.platform === 'win32') return;

    const root = mkdtempSync(join(tmpdir(), 'inkspan-office-benchmark-symlink-'));
    const outputDirectory = join(root, 'output');
    const victimPath = join(root, 'victim.json');
    try {
      mkdirSync(outputDirectory, { recursive: true });
      writeFileSync(victimPath, 'buyer-owned evidence\n', 'utf8');
      symlinkSync(victimPath, join(outputDirectory, 'docx-small.json'));

      expect(() => runGenerator(outputDirectory)).toThrow();
      expect(readFileSync(victimPath, 'utf8')).toBe('buyer-owned evidence\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
