import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CANONICAL_MIT_LICENSE = `MIT License

Copyright (c) 2026 ContextualWisdomLab

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const CHILD_PROCESS_TIMEOUT_MS = 30_000;
const CANONICAL_OFL_SHA256 =
  'eb7f35eae6a733ac55711f933739502c635f98eb19fa7788af92ed83dc3e10f5';

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function readTarEntry(archivePath: string, entryPath: string): string {
  return execFileSync('tar', ['-xOzf', archivePath, entryPath], {
    encoding: 'utf8',
    killSignal: 'SIGKILL',
    timeout: CHILD_PROCESS_TIMEOUT_MS,
  });
}

interface PackageLicenseManifest {
  readonly files?: readonly string[];
  readonly license?: string;
}

interface NpmPackEntry {
  readonly filename?: string;
}

describe('software and bundled-font license evidence', () => {
  it('keeps the root software license as exact canonical MIT text', () => {
    expect(readFileSync('LICENSE', 'utf8')).toBe(CANONICAL_MIT_LICENSE);
  });

  it('retains the bundled-font attribution and complete OFL terms separately', () => {
    expect(readFileSync('src/fonts/NOTICE', 'utf8')).toContain(
      'SIL Open Font License, Version 1.1',
    );
    expect(sha256(readFileSync('src/fonts/OFL.txt', 'utf8'))).toBe(
      CANONICAL_OFL_SHA256,
    );
  });

  it('keeps both software and bundled-font license evidence in the npm package manifest', () => {
    const packageManifest = JSON.parse(
      readFileSync('package.json', 'utf8'),
    ) as PackageLicenseManifest;

    expect(packageManifest.license).toBe('MIT');
    expect(packageManifest.files).toEqual(
      expect.arrayContaining(['LICENSE', 'src/fonts']),
    );
  });

  it(
    'retains both license families in the actual npm tarball',
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), 'inkspan-license-pack-'));

      try {
        const packMetadata = JSON.parse(
          execFileSync(
            'npm',
            [
              'pack',
              '--json',
              '--ignore-scripts',
              '--pack-destination',
              packRoot,
            ],
            {
              encoding: 'utf8',
              killSignal: 'SIGKILL',
              timeout: CHILD_PROCESS_TIMEOUT_MS,
            },
          ),
        ) as readonly NpmPackEntry[];

        expect(packMetadata).toHaveLength(1);
        const filename = packMetadata[0]?.filename;
        expect(filename).toEqual(expect.any(String));
        if (filename === undefined) {
          throw new Error(
            'npm pack did not report the generated tarball filename.',
          );
        }

        const archivePath = join(packRoot, filename);
        const archivePaths = execFileSync(
          'tar',
          ['-tzf', archivePath],
          {
            encoding: 'utf8',
            killSignal: 'SIGKILL',
            timeout: CHILD_PROCESS_TIMEOUT_MS,
          },
        )
          .split('\n')
          .filter((path) => path.length > 0);

        expect(archivePaths).toEqual(
          expect.arrayContaining([
            'package/LICENSE',
            'package/src/fonts/NOTICE',
            'package/src/fonts/OFL.txt',
          ]),
        );
        expect(readTarEntry(archivePath, 'package/LICENSE')).toBe(
          CANONICAL_MIT_LICENSE,
        );
        expect(readTarEntry(archivePath, 'package/src/fonts/NOTICE')).toBe(
          readFileSync('src/fonts/NOTICE', 'utf8'),
        );
        const packedOfl = readTarEntry(
          archivePath,
          'package/src/fonts/OFL.txt',
        );
        expect(packedOfl).toBe(readFileSync('src/fonts/OFL.txt', 'utf8'));
        expect(sha256(packedOfl)).toBe(CANONICAL_OFL_SHA256);
      } finally {
        rmSync(packRoot, { recursive: true, force: true });
      }
    },
    65_000,
  );
});
