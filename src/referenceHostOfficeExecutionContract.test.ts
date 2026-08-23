import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('reference-host Office execution acceptance', () => {
  it('renders the exact packed Markdown handoff through the local Office CLI and validates the DOCX', () => {
    const verifierPath = resolve(
      process.cwd(),
      'examples/reference-host/verify-office-handoff.mjs',
    );
    expect(existsSync(verifierPath)).toBe(true);
    if (!existsSync(verifierPath)) return;

    const verifier = readFileSync(verifierPath, 'utf8');
    const workflow = repositoryFile('.github/workflows/ci.yml');

    expect(verifier).toContain('INKSPAN_BROWSER_PACKAGE_ENTRY');
    expect(verifier).toContain('office-handoff.mjs');
    expect(verifier).toContain("'-m', 'inkspan_office.cli'");
    expect(verifier).toContain('document.core_properties.title');
    expect(verifier).toContain('Buyer-ready body.');
    expect(verifier).toContain('mkdtemp');
    expect(verifier).toContain('rm(temporaryDirectory');

    expect(workflow).toContain(
      'Verify exact packed reference-host Office handoff',
    );
    expect(workflow).toContain(
      'python -m pip install --require-hashes --only-binary=:all: -r office/requirements-ci.txt',
    );
    expect(workflow).toContain(
      'node examples/reference-host/verify-office-handoff.mjs',
    );
  });
});
