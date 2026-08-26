import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const markdownMeasurementScript = resolve(
  repositoryRoot,
  'benchmarks/measure-markdown.mjs',
);
const revisionMeasurementScript = resolve(
  repositoryRoot,
  'benchmarks/measure-revision-evidence.mjs',
);
const firstSourceSha = 'a'.repeat(40);
const movedSourceSha = 'b'.repeat(40);
const runtimeId = `node-${process.versions.node}`;
const referenceHardwareId = `refhw-sha256-${'c'.repeat(64)}`;

function sha256(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

function movingGitEnvironment(root: string): NodeJS.ProcessEnv {
  const fakeBin = join(root, 'fake-bin');
  const statePath = join(root, 'git-invocations.txt');
  const fakeGit = join(fakeBin, 'git');
  const script = `#!/usr/bin/env node
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const state = process.env.INKSPAN_FAKE_GIT_STATE;
const first = process.env.INKSPAN_FAKE_GIT_FIRST_SHA;
const moved = process.env.INKSPAN_FAKE_GIT_MOVED_SHA;
const count = existsSync(state) ? Number(readFileSync(state, 'utf8')) : 0;
writeFileSync(state, String(count + 1), 'utf8');
process.stdout.write(\`${'${count === 0 ? first : moved}'}\\n\`);
`;
  writeFileSync(fakeGit, script, { encoding: 'utf8', mode: 0o755 });
  chmodSync(fakeGit, 0o755);
  return {
    ...process.env,
    PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ''}`,
    INKSPAN_FAKE_GIT_STATE: statePath,
    INKSPAN_FAKE_GIT_FIRST_SHA: firstSourceSha,
    INKSPAN_FAKE_GIT_MOVED_SHA: movedSourceSha,
  };
}

function markdownInvocation(root: string) {
  const input = join(root, 'document.md');
  const modulePath = join(root, 'markdown.mjs');
  const output = join(root, 'markdown-samples.json');
  const moduleSource =
    'export function markdownToHtml(source) { return `<p>${source}</p>`; }\n';
  writeFileSync(input, '# Source movement fixture\n', 'utf8');
  writeFileSync(modulePath, moduleSource, 'utf8');

  const result = spawnSync(
    process.execPath,
    [
      markdownMeasurementScript,
      '--input',
      input,
      '--module',
      modulePath,
      '--profile',
      'small',
      '--samples',
      '1',
      '--source-commit-sha',
      firstSourceSha,
      '--artifact-sha256',
      sha256(moduleSource),
      '--runtime-id',
      runtimeId,
      '--reference-hardware-id',
      referenceHardwareId,
      '--output',
      output,
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: movingGitEnvironment(root),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return { output, result };
}

function revisionInvocation(root: string) {
  const input = join(root, 'document-envelope.json');
  const modulePath = join(root, 'revision.mjs');
  const output = join(root, 'revision-samples.json');
  const moduleSource = `export async function createDocumentEnvelopeRevisionEvidenceBytes() { return { revision: { digestHex: '${'d'.repeat(64)}' } }; }\n`;
  writeFileSync(
    input,
    '{"contractVersion":1,"mode":"markdown","document":"# Source movement fixture"}\n',
    'utf8',
  );
  writeFileSync(modulePath, moduleSource, 'utf8');

  const result = spawnSync(
    process.execPath,
    [
      revisionMeasurementScript,
      '--input',
      input,
      '--module',
      modulePath,
      '--profile',
      'small',
      '--samples',
      '1',
      '--source-commit-sha',
      firstSourceSha,
      '--artifact-sha256',
      sha256(moduleSource),
      '--runtime-id',
      runtimeId,
      '--reference-hardware-id',
      referenceHardwareId,
      '--output',
      output,
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: movingGitEnvironment(root),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return { output, result };
}

describe.skipIf(process.platform === 'win32')(
  'direct benchmark producer source stability',
  () => {
    it.each([
      ['Markdown', markdownInvocation],
      ['revision', revisionInvocation],
    ] as const)(
      'rejects %s evidence when checked-out HEAD moves during sample acquisition',
      (_label, invoke) => {
        const root = mkdtempSync(join(tmpdir(), 'inkspan-producer-source-move-'));
        try {
          const { output, result } = invoke(root);
          expect(result.status).toBe(1);
          expect(result.stdout).toBe('');
          expect(result.stderr.trim()).toBe(
            'Benchmark measurement source commit does not match checked-out HEAD.',
          );
          expect(existsSync(output)).toBe(false);
        } finally {
          rmSync(root, { recursive: true, force: true });
        }
      },
    );
  },
);
