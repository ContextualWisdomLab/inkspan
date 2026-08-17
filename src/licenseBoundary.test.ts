import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

interface PackageLicenseManifest {
  readonly files?: readonly string[];
  readonly license?: string;
}

interface NpmPackDryRunEntry {
  readonly files?: readonly { readonly path?: string }[];
}

describe('software and bundled-font license evidence', () => {
  it('keeps the root software license as exact canonical MIT text', () => {
    expect(readFileSync('LICENSE', 'utf8')).toBe(CANONICAL_MIT_LICENSE);
  });

  it('retains the bundled-font attribution and complete OFL terms separately', () => {
    expect(readFileSync('src/fonts/NOTICE', 'utf8')).toContain(
      'SIL Open Font License, Version 1.1',
    );
    expect(readFileSync('src/fonts/OFL.txt', 'utf8')).toContain(
      'SIL OPEN FONT LICENSE Version 1.1',
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

  it('retains both license families in the actual npm packlist', () => {
    const packMetadata = JSON.parse(
      execFileSync(
        'npm',
        ['pack', '--dry-run', '--json', '--ignore-scripts'],
        { encoding: 'utf8' },
      ),
    ) as readonly NpmPackDryRunEntry[];

    expect(packMetadata).toHaveLength(1);
    const packedPaths = packMetadata[0]?.files?.flatMap(({ path }) =>
      path === undefined ? [] : [path],
    ) ?? [];
    expect(packedPaths).toEqual(
      expect.arrayContaining([
        'LICENSE',
        'src/fonts/NOTICE',
        'src/fonts/OFL.txt',
      ]),
    );
  });
});
