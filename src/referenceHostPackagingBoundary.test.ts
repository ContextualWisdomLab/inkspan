import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const referenceHostDirectory = resolve(process.cwd(), 'examples/reference-host');

function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('reference-host package authority boundary', () => {
  it('keeps every reference-host file outside the npm publish inventory', () => {
    const packageMetadata = JSON.parse(repositoryFile('package.json')) as {
      files: string[];
    };

    expect(packageMetadata.files.some((path) => path.startsWith('examples'))).toBe(
      false,
    );
  });

  it('rejects source-relative and workspace-alias imports in executable reference files', () => {
    const executableFiles = readdirSync(referenceHostDirectory).filter((path) =>
      /\.(?:[cm]?[jt]s|[jt]sx)$/u.test(path),
    );

    expect(executableFiles).toEqual(
      expect.arrayContaining([
        'hydration-gate.tsx',
        'native-form-host.tsx',
        'single-flight-submission.ts',
      ]),
    );
    expect(executableFiles.length).toBeGreaterThan(0);
    for (const file of executableFiles) {
      const source = readFileSync(resolve(referenceHostDirectory, file), 'utf8');
      expect(source).not.toMatch(/(?:from|import\()\s*['"][^'"]*src\//u);
      expect(source).not.toContain('workspace:');
    }
  });
});
