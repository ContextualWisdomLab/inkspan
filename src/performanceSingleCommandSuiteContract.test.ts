import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const suitePath = resolve(repositoryRoot, 'benchmarks/run-current-suite.mjs');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('single-command benchmark suite contract', () => {
  it('measures and summarizes one deterministic Markdown profile with one command', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-suite-'));
    temporaryDirectories.push(directory);
    const inputPath = join(directory, 'input.md');
    const modulePath = join(directory, 'measured.mjs');
    const outputDirectory = join(directory, 'evidence');
    const moduleSource =
      "export function markdownToHtml(source) { return `<p>${source}</p>`; }\n";
    writeFileSync(inputPath, '# Buyer benchmark\n', 'utf8');
    writeFileSync(modulePath, moduleSource, 'utf8');
    const artifactSha256 = createHash('sha256')
      .update(moduleSource)
      .digest('hex');

    const output = execFileSync(
      process.execPath,
      [
        suitePath,
        '--input',
        inputPath,
        '--module',
        modulePath,
        '--profile',
        'small',
        '--samples',
        '2',
        '--source-commit-sha',
        'a'.repeat(40),
        '--artifact-sha256',
        artifactSha256,
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

    expect(JSON.parse(output.trim())).toEqual({
      contractVersion: 1,
      documentProfile: 'small',
      samples: 'samples.json',
      status: 'completed',
      summaryJson: 'summary/summary.json',
      summaryText: 'summary/summary.txt',
    });

    const samples = JSON.parse(
      readFileSync(join(outputDirectory, 'samples.json'), 'utf8'),
    ) as { benchmarkId?: unknown; documentProfile?: unknown; samples?: unknown };
    expect(samples.benchmarkId).toBe('markdown-serialization-small');
    expect(samples.documentProfile).toBe('small');
    expect(samples.samples).toHaveLength(2);

    const summary = JSON.parse(
      readFileSync(join(outputDirectory, 'summary', 'summary.json'), 'utf8'),
    ) as { benchmarkId?: unknown; documentProfile?: unknown };
    expect(summary.benchmarkId).toBe('markdown-serialization-small');
    expect(summary.documentProfile).toBe('small');
    expect(
      readFileSync(join(outputDirectory, 'summary', 'summary.txt'), 'utf8'),
    ).toContain('markdown-serialization-small');
  });
});
