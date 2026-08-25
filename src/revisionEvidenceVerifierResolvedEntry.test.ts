import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const verifierSource = readFileSync(
  resolve(process.cwd(), 'scripts/verify-revision-evidence-package.mjs'),
  'utf8',
);

function extractGeneratedRuntimeSource(functionName: string): string {
  const functionStart = verifierSource.indexOf(`function ${functionName}`);
  expect(functionStart).not.toBe(-1);

  const writeStart = verifierSource.indexOf('writeFileSync(', functionStart);
  expect(writeStart).not.toBe(-1);

  const templateStart = verifierSource.indexOf('`', writeStart);
  const templateEnd = verifierSource.indexOf("`,\n    'utf8',", templateStart);
  expect(templateStart).not.toBe(-1);
  expect(templateEnd).not.toBe(-1);

  return verifierSource.slice(templateStart + 1, templateEnd);
}

describe('packed revision-evidence runtime entry binding', () => {
  it('loads the exact canonical entry that passed containment validation', () => {
    const esmSource = extractGeneratedRuntimeSource(
      'verifyRevisionEvidenceEsmRuntime',
    );
    const commonJsSource = extractGeneratedRuntimeSource(
      'verifyRevisionEvidenceCommonJsRuntime',
    );

    expect(esmSource).toContain(
      "import { fileURLToPath, pathToFileURL } from 'node:url';",
    );
    expect(esmSource).toContain(
      'const editor = await import(pathToFileURL(resolvedEntry).href);',
    );
    expect(esmSource).not.toContain("await import('${packageJson.name}')");

    expect(commonJsSource).toContain('const editor = require(resolvedEntry);');
    expect(commonJsSource).not.toContain(
      "const editor = require('${packageJson.name}')",
    );
  });
});
