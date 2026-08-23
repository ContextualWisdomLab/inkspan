import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const measurementScript = resolve(
  process.cwd(),
  'benchmarks/measure-revision-evidence.mjs',
);

function writeSyntheticEnvelope(path: string): void {
  writeFileSync(
    path,
    JSON.stringify({
      schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
      schemaVersion: 1,
      documentJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Synthetic benchmark content' }],
          },
        ],
      },
    }),
    'utf8',
  );
}

describe('revision benchmark module-path privacy contract', () => {
  it('redacts filesystem details when module-path resolution crosses a non-directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-revision-module-path-'));
    const input = join(root, 'small.json');
    const privateSentinel = 'tenant-private-revision-module-parent';
    const blockedParent = join(root, privateSentinel);
    const modulePath = join(blockedParent, 'packed-revision-evidence.mjs');
    const output = join(root, 'samples.json');

    try {
      writeSyntheticEnvelope(input);
      writeFileSync(blockedParent, 'not a directory', 'utf8');

      const result = spawnSync(
        process.execPath,
        [
          measurementScript,
          '--input',
          input,
          '--module',
          modulePath,
          '--profile',
          'small',
          '--samples',
          '1',
          '--source-commit-sha',
          'a'.repeat(40),
          '--artifact-sha256',
          'b'.repeat(64),
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
        'Measured revision module must be a local regular file.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
