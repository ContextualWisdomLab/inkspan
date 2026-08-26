import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const measurementScript = resolve(
  process.cwd(),
  'benchmarks/measure-markdown.mjs',
);
const SOURCE_COMMIT_SHA = execFileSync(
  'git',
  ['rev-parse', '--verify', 'HEAD'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
).trim();
const RUNTIME_ID = `node-${process.versions.node}`;
const REFERENCE_HARDWARE_ID = 'github-actions-ubuntu-24.04-x64';

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('HTML serialization performance measurement', () => {
  it('measures packed htmlToMarkdown without falling back to markdownToHtml', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-html-serialization-'));
    const input = join(root, 'small.html');
    const modulePath = join(root, 'packed-markdown.mjs');
    const output = join(root, 'samples.json');

    try {
      writeFileSync(input, '<p>Synthetic benchmark fixture</p>\n', 'utf8');
      writeFileSync(
        modulePath,
        [
          "export function markdownToHtml() { throw new Error('wrong serialization direction'); }",
          "export function htmlToMarkdown(source) { return source.replace(/<[^>]+>/gu, '').trim(); }",
          '',
        ].join('\n'),
        'utf8',
      );

      const result = spawnSync(
        process.execPath,
        [
          measurementScript,
          '--input',
          input,
          '--module',
          modulePath,
          '--operation',
          'html-to-markdown',
          '--profile',
          'small',
          '--samples',
          '2',
          '--source-commit-sha',
          SOURCE_COMMIT_SHA,
          '--artifact-sha256',
          sha256(modulePath),
          '--runtime-id',
          RUNTIME_ID,
          '--reference-hardware-id',
          REFERENCE_HARDWARE_ID,
          '--output',
          output,
        ],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');

      const evidence = JSON.parse(readFileSync(output, 'utf8')) as {
        benchmarkId: string;
        unit: string;
        documentProfile: string;
        samples: unknown[];
      };
      expect(evidence.benchmarkId).toBe('html-serialization-small');
      expect(evidence.unit).toBe('ms');
      expect(evidence.documentProfile).toBe('small');
      expect(evidence.samples).toHaveLength(2);
      expect(
        evidence.samples.every(
          (sample) =>
            typeof sample === 'number' && Number.isFinite(sample) && sample >= 0,
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
