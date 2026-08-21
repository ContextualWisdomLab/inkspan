import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const verifierPath = resolve(
  repositoryRoot,
  'examples/reference-host/verify-packed-artifact.mjs',
);
const packageMetadata = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
) as { name: string; version: string };

describe('reference-host packed artifact acceptance', () => {
  it(
    'builds, packs, installs, and SSR-imports the exact tarball in an isolated consumer',
    () => {
      const output = execFileSync(process.execPath, [verifierPath], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180_000,
      });

      const result = JSON.parse(output.trim()) as {
        packageName?: unknown;
        packageVersion?: unknown;
        installedFromTarball?: unknown;
        consumerInstallCompleted?: unknown;
        serverRenderedNamedField?: unknown;
        publicAssetEntriesContained?: unknown;
        sourceImportDetected?: unknown;
      };

      expect(result.packageName).toBe(packageMetadata.name);
      expect(result.packageVersion).toBe(packageMetadata.version);
      expect(result.installedFromTarball).toBe(true);
      expect(result.consumerInstallCompleted).toBe(true);
      expect(result.serverRenderedNamedField).toBe(true);
      expect(result.publicAssetEntriesContained).toBe(true);
      expect(result.sourceImportDetected).toBe(false);
    },
    180_000,
  );
});
