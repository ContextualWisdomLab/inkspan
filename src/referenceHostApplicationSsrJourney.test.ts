import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const verifierPath = resolve(
  repositoryRoot,
  'examples/reference-host/verify-application-ssr.mjs',
);
const packageMetadata = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
) as { name: string; version: string };

describe('reference-host application SSR acceptance', () => {
  it(
    'server-renders the application shell against the exact packed package while deferring the client editor boundary',
    () => {
      const output = execFileSync(
        process.execPath,
        [verifierPath, '--self-test'],
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 180_000,
        },
      );

      const result = JSON.parse(output.trim()) as {
        packageName?: unknown;
        packageVersion?: unknown;
        packageAuthority?: unknown;
        applicationServerRendered?: unknown;
        clientEditorDeferred?: unknown;
      };

      expect(result.packageName).toBe(packageMetadata.name);
      expect(result.packageVersion).toBe(packageMetadata.version);
      expect(result.packageAuthority).toBe('exact-packed-tarball');
      expect(result.applicationServerRendered).toBe(true);
      expect(result.clientEditorDeferred).toBe(true);
    },
    180_000,
  );
});
