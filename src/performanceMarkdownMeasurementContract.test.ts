import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

interface BenchmarkSamples {
  readonly contractVersion: 3;
  readonly benchmarkId: string;
  readonly unit: 'ms';
  readonly sourceCommitSha: string;
  readonly artifactSha256: string;
  readonly documentProfile: 'small' | 'medium' | 'large' | 'stress';
  readonly runtimeId: string;
  readonly referenceHardwareId: string;
  readonly samples: number[];
}

const repositoryRoot = process.cwd();
const measurementScript = resolve(
  repositoryRoot,
  'benchmarks/measure-markdown.mjs',
);
const summaryScript = resolve(repositoryRoot, 'benchmarks/summarize-samples.mjs');
const SOURCE_COMMIT_SHA = execFileSync(
  'git',
  ['rev-parse', '--verify', 'HEAD'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
).trim();
const FALLBACK_ARTIFACT_SHA256 = 'b'.repeat(64);
const RUNTIME_ID = `node-${process.versions.node}`;
const HARDWARE_ID = 'github-actions-ubuntu-24.04-x64';

function fileSha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function measurementArguments(
  input: string,
  modulePath: string,
  output: string,
  artifactSha256 = existsSync(modulePath)
    ? fileSha256(modulePath)
    : FALLBACK_ARTIFACT_SHA256,
): string[] {
  return [
    measurementScript,
    '--input',
    input,
    '--module',
    modulePath,
    '--profile',
    'large',
    '--samples',
    '3',
    '--source-commit-sha',
    SOURCE_COMMIT_SHA,
    '--artifact-sha256',
    artifactSha256,
    '--runtime-id',
    RUNTIME_ID,
    '--reference-hardware-id',
    HARDWARE_ID,
    '--output',
    output,
  ];
}

describe('Markdown runtime measurement contract', () => {
  it.each(['', '\uFEFF'])('writes bounded privacy-safe samples with UTF-8 prefix %j', (prefix) => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-measurement-'));
    const input = join(root, 'large.md');
    const modulePath = join(root, 'packed-markdown.mjs');
    const samplesPath = join(root, 'samples.json');
    const summaryDirectory = join(root, 'summary');
    try {
      writeFileSync(input, `${prefix}# Buyer benchmark fixture\n\nSynthetic content only.\n`, 'utf8');
      writeFileSync(
        modulePath,
        "let measuredCalls = 0;\nexport function markdownToHtml(source) { if (++measuredCalls > 3) throw new Error('Unmeasured invocation'); return `<p>${source.length}</p>`; }\n",
        'utf8',
      );
      const artifactSha256 = fileSha256(modulePath);

      execFileSync(
        process.execPath,
        measurementArguments(input, modulePath, samplesPath, artifactSha256),
        { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'pipe'] },
      );

      const samples = JSON.parse(
        readFileSync(samplesPath, 'utf8'),
      ) as BenchmarkSamples;
      expect(samples).toMatchObject({
        contractVersion: 3,
        benchmarkId: 'markdown-serialization-large',
        unit: 'ms',
        sourceCommitSha: SOURCE_COMMIT_SHA,
        artifactSha256,
        inputSha256: fileSha256(input),
        documentProfile: 'large',
        runtimeId: RUNTIME_ID,
        referenceHardwareId: HARDWARE_ID,
      });
      expect(samples.samples).toHaveLength(3);
      expect(
        samples.samples.every(
          (sample) => Number.isFinite(sample) && sample >= 0,
        ),
      ).toBe(true);
      expect(readFileSync(samplesPath, 'utf8')).not.toContain('Buyer benchmark fixture');
      expect(readFileSync(samplesPath, 'utf8')).not.toContain('Synthetic content only');

      execFileSync(
        process.execPath,
        [summaryScript, '--input', samplesPath, '--output', summaryDirectory],
        { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const summary = JSON.parse(
        readFileSync(join(summaryDirectory, 'summary.json'), 'utf8'),
      ) as { sampleCount: number; benchmarkId: string; unit: string };
      expect(summary).toMatchObject({
        contractVersion: 3,
        sampleCount: 3,
        benchmarkId: 'markdown-serialization-large',
        unit: 'ms',
        inputSha256: fileSha256(input),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('identifies captured bytes even if the file changes after reading', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-captured-input-'));
    const input = join(root, 'input.md');
    const modulePath = join(root, 'serializer.mjs');
    const output = join(root, 'samples.json');
    try {
      writeFileSync(input, '\uFEFF# Captured input\n', 'utf8');
      const inputSha256 = fileSha256(input);
      writeFileSync(modulePath, `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(input)}, '# Later replacement\\n');
export function markdownToHtml(source) {
  if (source !== '# Captured input\\n') throw new Error('wrong captured input');
  return '<h1>Captured input</h1>';
}\n`);
      execFileSync(process.execPath, measurementArguments(input, modulePath, output), { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'pipe'] });
      expect(fileSha256(input)).not.toBe(inputSha256);
      expect(JSON.parse(readFileSync(output, 'utf8'))).toMatchObject({ inputSha256, samples: [expect.any(Number), expect.any(Number), expect.any(Number)] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['markdown-to-html', 'markdownToHtml', 1],
    ['markdown-to-html', 'markdownToHtml', 3],
    ['html-to-markdown', 'htmlToMarkdown', 1],
    ['html-to-markdown', 'htmlToMarkdown', 3],
  ] as const)('rejects %s non-string result from %s on invocation %i', (operation, exportName, invalidCall) => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-serialization-invalid-result-'));
    const input = join(root, 'input.md');
    const modulePath = join(root, 'packed-markdown.mjs');
    const samplesPath = join(root, 'samples.json');
    try {
      writeFileSync(input, '# Synthetic\n', 'utf8');
      writeFileSync(modulePath,
        `let calls = 0;\nexport function ${exportName}() { return ++calls === ${invalidCall} ? { privateContent: 'never publish this' } : ''; }\n`,
        'utf8');
      const args = measurementArguments(input, modulePath, samplesPath);
      args.splice(5, 0, '--operation', operation);
      const result = spawnSync(process.execPath, args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(`Measured ${exportName}() must return a string.`);
      expect(existsSync(samplesPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['markdown-to-html', 'markdownToHtml', 2],
    ['markdown-to-html', 'markdownToHtml', 3],
    ['html-to-markdown', 'htmlToMarkdown', 2],
    ['html-to-markdown', 'htmlToMarkdown', 3],
  ] as const)('rejects changing %s output from %s on invocation %i', (operation, exportName, changedCall) => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-serialization-changing-result-'));
    const input = join(root, 'input.md');
    const modulePath = join(root, 'serializer.mjs');
    const output = join(root, 'samples.json');
    try {
      writeFileSync(input, '# Synthetic\n');
      writeFileSync(modulePath, `let calls = 0;
export function ${exportName}() { return ++calls === ${changedCall} ? 'private changed output' : ''; }\n`);
      const args = measurementArguments(input, modulePath, output);
      args.splice(5, 0, '--operation', operation);
      const result = spawnSync(process.execPath, args, { cwd: repositoryRoot, encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe('Measured serialization output changed for identical input.');
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed before output when the measured module lacks the public serializer', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-measurement-export-'));
    const input = join(root, 'small.md');
    const modulePath = join(root, 'packed-markdown.mjs');
    const samplesPath = join(root, 'samples.json');
    try {
      writeFileSync(input, '# Synthetic\n', 'utf8');
      writeFileSync(modulePath, 'export const other = true;\n', 'utf8');

      const result = spawnSync(
        process.execPath,
        measurementArguments(input, modulePath, samplesPath),
        { cwd: repositoryRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Measured Markdown module must export markdownToHtml().',
      );
      expect(existsSync(samplesPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects symlinked document inputs before reading benchmark content', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-measurement-symlink-'));
    const realInput = join(root, 'real.md');
    const input = join(root, 'linked.md');
    const modulePath = join(root, 'packed-markdown.mjs');
    const samplesPath = join(root, 'samples.json');
    try {
      writeFileSync(realInput, '# Synthetic\n', 'utf8');
      symlinkSync(realInput, input);
      writeFileSync(
        modulePath,
        'export function markdownToHtml(source) { return source; }\n',
        'utf8',
      );

      const result = spawnSync(
        process.execPath,
        measurementArguments(input, modulePath, samplesPath),
        { cwd: repositoryRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Markdown benchmark input must be a regular non-symlink file.',
      );
      expect(existsSync(samplesPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an output path that aliases the measured module', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-measurement-output-'));
    const input = join(root, 'small.md');
    const modulePath = join(root, 'packed-markdown.mjs');
    const moduleSource =
      'export function markdownToHtml(source) { return `<p>${source}</p>`; }\n';
    try {
      writeFileSync(input, '# Synthetic\n', 'utf8');
      writeFileSync(modulePath, moduleSource, 'utf8');
      const result = spawnSync(
        process.execPath,
        measurementArguments(input, modulePath, modulePath),
        { cwd: repositoryRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Markdown benchmark output must not overwrite the measured module.',
      );
      expect(readFileSync(modulePath, 'utf8')).toBe(moduleSource);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires a file-backed module URL rather than network or package-name resolution', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-measurement-module-'));
    const input = join(root, 'small.md');
    const samplesPath = join(root, 'samples.json');
    try {
      writeFileSync(input, '# Synthetic\n', 'utf8');
      const result = spawnSync(
        process.execPath,
        measurementArguments(
          input,
          'https://example.invalid/markdown.mjs',
          samplesPath,
        ),
        { cwd: repositoryRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Measured Markdown module must be a local regular file.',
      );
      expect(existsSync(samplesPath)).toBe(false);
      expect(() => pathToFileURL(input)).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
