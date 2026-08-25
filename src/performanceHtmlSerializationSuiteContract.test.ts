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

const repositoryRoot = process.cwd();
const suitePath = resolve(repositoryRoot, 'benchmarks/run-current-suite.mjs');
const currentSourceCommitSha = execFileSync(
  'git',
  ['rev-parse', '--verify', 'HEAD'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
).trim();

function sha256(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

describe('single-command HTML serialization benchmark contract', () => {
  it('measures HTML-to-Markdown serialization alongside Markdown and revision evidence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-html-suite-'));
    const markdownInput = join(directory, 'document.md');
    const htmlInput = join(directory, 'document.html');
    const markdownModule = join(directory, 'markdown.mjs');
    const revisionInput = join(directory, 'document-envelope.json');
    const revisionModule = join(directory, 'revision.mjs');
    const outputDirectory = join(directory, 'evidence');
    const markdownModuleSource = [
      "export function markdownToHtml(source) { return `<p>${source}</p>`; }",
      "export function htmlToMarkdown(source) { return source.replace(/<[^>]+>/gu, '').trim(); }",
      '',
    ].join('\n');
    const revisionModuleSource = `export async function createDocumentEnvelopeRevisionEvidenceBytes() { return { revision: { digestHex: '${'c'.repeat(64)}' } }; }\n`;

    try {
      writeFileSync(markdownInput, '# Buyer benchmark\n', 'utf8');
      writeFileSync(htmlInput, '<h1>Buyer benchmark</h1>\n', 'utf8');
      writeFileSync(markdownModule, markdownModuleSource, 'utf8');
      writeFileSync(
        revisionInput,
        '{"contractVersion":1,"mode":"markdown","document":"# Buyer benchmark"}\n',
        'utf8',
      );
      writeFileSync(revisionModule, revisionModuleSource, 'utf8');

      const result = spawnSync(
        process.execPath,
        [
          suitePath,
          '--input',
          markdownInput,
          '--html-input',
          htmlInput,
          '--module',
          markdownModule,
          '--revision-input',
          revisionInput,
          '--revision-module',
          revisionModule,
          '--profile',
          'small',
          '--samples',
          '2',
          '--source-commit-sha',
          currentSourceCommitSha,
          '--artifact-sha256',
          sha256(markdownModuleSource),
          '--revision-artifact-sha256',
          sha256(revisionModuleSource),
          '--runtime-id',
          'node-22.0.0',
          '--reference-hardware-id',
          `refhw-sha256-${'b'.repeat(64)}`,
          '--output',
          outputDirectory,
        ],
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 10_000,
        },
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');

      const manifest = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
      expect(manifest).toMatchObject({
        htmlSerializationSamples: 'html-serialization/samples.json',
        htmlSerializationSummaryJson:
          'html-serialization/summary/summary.json',
        htmlSerializationSummaryText:
          'html-serialization/summary/summary.txt',
        status: 'completed',
      });

      const samples = JSON.parse(
        readFileSync(
          join(outputDirectory, 'html-serialization', 'samples.json'),
          'utf8',
        ),
      ) as {
        benchmarkId?: unknown;
        documentProfile?: unknown;
        samples?: unknown[];
      };
      expect(samples.benchmarkId).toBe('html-serialization-small');
      expect(samples.documentProfile).toBe('small');
      expect(samples.samples).toHaveLength(2);

      const summary = JSON.parse(
        readFileSync(
          join(
            outputDirectory,
            'html-serialization',
            'summary',
            'summary.json',
          ),
          'utf8',
        ),
      ) as { benchmarkId?: unknown };
      expect(summary.benchmarkId).toBe('html-serialization-small');
      expect(
        readFileSync(
          join(
            outputDirectory,
            'html-serialization',
            'summary',
            'summary.txt',
          ),
          'utf8',
        ),
      ).toContain('html-serialization-small');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
