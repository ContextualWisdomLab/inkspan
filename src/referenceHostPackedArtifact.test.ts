import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const verifierPath = resolve(
  repositoryRoot,
  'examples/reference-host/verify-packed-artifact.mjs',
);

describe('reference-host packed artifact acceptance', () => {
  it(
    'builds, packs, installs, and SSR-imports the exact tarball without network fallback',
    () => {
      const output = execFileSync(process.execPath, [verifierPath], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          INKSPAN_REFERENCE_HOST_EXPECTED_HEAD: process.env.GITHUB_SHA ?? '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180_000,
      });

      const result = JSON.parse(output.trim()) as {
        packageName?: unknown;
        packageVersion?: unknown;
        installedFromTarball?: unknown;
        offlineInstall?: unknown;
        serverRenderedNamedField?: unknown;
        sourceImportDetected?: unknown;
      };

      expect(result.packageName).toBe('@contextualwisdomlab/cwl-editor');
      expect(result.packageVersion).toBe('0.6.0');
      expect(result.installedFromTarball).toBe(true);
      expect(result.offlineInstall).toBe(true);
      expect(result.serverRenderedNamedField).toBe(true);
      expect(result.sourceImportDetected).toBe(false);
    },
    180_000,
  );
});
