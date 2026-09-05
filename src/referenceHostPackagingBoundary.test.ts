import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const referenceHostDirectory = resolve(process.cwd(), 'examples/reference-host');

function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function referenceHostExecutableFiles(): string[] {
  return readdirSync(referenceHostDirectory).filter((path) =>
    /\.(?:[cm]?[jt]s|[jt]sx)$/u.test(path),
  );
}

function referenceHostRuntimeFiles(): string[] {
  return referenceHostExecutableFiles().filter(
    (path) => !path.startsWith('verify-'),
  );
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
    const executableFiles = referenceHostExecutableFiles();

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

  it('rejects runtime environment-variable authority in reference-host runtime files', () => {
    const runtimeFiles = referenceHostRuntimeFiles();

    expect(runtimeFiles).toEqual(
      expect.arrayContaining([
        'browser-host.tsx',
        'reference-host-app.tsx',
        'native-form-host.tsx',
      ]),
    );
    expect(runtimeFiles.length).toBeGreaterThan(0);
    for (const file of runtimeFiles) {
      const source = readFileSync(resolve(referenceHostDirectory, file), 'utf8');
      expect(source).not.toMatch(/\bprocess\s*\.\s*env\b/u);
      expect(source).not.toMatch(/\bimport\s*\.\s*meta\s*\.\s*env\b/u);
    }
  });

  it('keeps the buyer-facing inventory synchronized without claiming complete app acceptance', () => {
    const readme = readFileSync(resolve(referenceHostDirectory, 'README.md'), 'utf8');
    const executableFiles = referenceHostExecutableFiles();

    for (const file of executableFiles) {
      expect(readme).toContain(`\`${file}\``);
    }
    expect(readme).toContain('`presentation-full.css`');
    expect(readme).toContain('`presentation-latin.css`');
    expect(readme).toContain(
      'exact packed autosave observer wiring into the host lifecycle projection',
    );
    expect(readme).not.toContain('packed-package wiring of the autosave observer');
    expect(readme).toContain('complete reference-host application');
    expect(readme).toContain(
      'do **not** yet satisfy #377\'s complete packed-artifact framework-application acceptance.',
    );
  });
});