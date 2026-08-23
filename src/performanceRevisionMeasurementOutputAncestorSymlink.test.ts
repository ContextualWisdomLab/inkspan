import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
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

const script = resolve(process.cwd(), 'benchmarks/measure-revision-evidence.mjs');

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('revision benchmark output path ancestry', () => {
  it('fails closed before writing beneath a symlinked output ancestor', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-revision-output-ancestor-'));
    const input = join(root, 'document-envelope.json');
    const modulePath = join(root, 'packed-revision-evidence.mjs');
    const outside = join(root, 'outside-target');
    const alias = join(root, 'aliased-parent');
    const output = join(alias, 'nested-output', 'samples.json');
    try {
      writeFileSync(
        input,
        JSON.stringify({
          schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
          schemaVersion: 1,
          documentJson: { type: 'doc', content: [] },
        }),
        'utf8',
      );
      writeFileSync(
        modulePath,
        'export async function createDocumentEnvelopeRevisionEvidenceBytes(source) { return { revision: { digestHex: String(source.byteLength).padStart(64, "0") } }; }\n',
        'utf8',
      );
      mkdirSync(outside);
      symlinkSync(outside, alias, process.platform === 'win32' ? 'junction' : 'dir');

      const result = spawnSync(
        process.execPath,
        [
          script,
          '--input',
          input,
          '--module',
          modulePath,
          '--profile',
          'large',
          '--samples',
          '1',
          '--source-commit-sha',
          'a'.repeat(40),
          '--artifact-sha256',
          sha256(modulePath),
          '--runtime-id',
          'node-22.18.0',
          '--reference-hardware-id',
          'github-actions-ubuntu-24.04-x64',
          '--output',
          output,
        ],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Revision benchmark output directory must be a non-symlink directory.',
      );
      expect(existsSync(join(outside, 'nested-output', 'samples.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
