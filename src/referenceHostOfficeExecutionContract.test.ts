import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('reference-host Office execution acceptance', () => {
  it('executes the self-contained exact-packed Office journey and documents the package-authority split', () => {
    const verifierPath = resolve(
      process.cwd(),
      'examples/reference-host/verify-office-handoff.mjs',
    );
    const packedVerifierPath = resolve(
      process.cwd(),
      'examples/reference-host/verify-packed-office-journey.mjs',
    );
    expect(existsSync(verifierPath)).toBe(true);
    expect(existsSync(packedVerifierPath)).toBe(true);
    if (!existsSync(verifierPath) || !existsSync(packedVerifierPath)) return;

    const verifier = readFileSync(verifierPath, 'utf8');
    const packedVerifier = readFileSync(packedVerifierPath, 'utf8');
    const workflow = repositoryFile('.github/workflows/ci.yml');
    const readme = repositoryFile('examples/reference-host/README.md');

    expect(verifier).toContain('INKSPAN_BROWSER_PACKAGE_ENTRY');
    expect(verifier).toContain('office-handoff.mjs');
    expect(verifier).toContain('createReferenceDocxRequest');
    expect(verifier).not.toContain('createDocxHandoff');
    expect(verifier).toContain("'-m', 'inkspan_office.cli'");
    expect(verifier).toContain('document.core_properties.title');
    expect(verifier).toContain('Buyer-ready body.');
    expect(verifier).toContain('mkdtemp');
    expect(verifier).toContain('rm(temporaryDirectory');

    expect(packedVerifier).toContain("packageAuthority: 'exact-packed-tarball'");
    expect(packedVerifier).toContain("run('pnpm', ['build']");
    expect(packedVerifier).toContain(
      "run('pnpm', ['pack', '--pack-destination', packDirectory])",
    );
    expect(packedVerifier).toContain("'verify-office-handoff.mjs'");
    expect(packedVerifier).toContain('INKSPAN_BROWSER_PACKAGE_ENTRY: packageEntry');

    expect(workflow).toContain(
      'Verify self-contained exact-packed reference-host Office journey',
    );
    expect(workflow).toContain(
      'python -m pip install --require-hashes --only-binary=:all: -r office/requirements-ci.txt',
    );
    expect(workflow).toContain(
      'node examples/reference-host/verify-packed-office-journey.mjs --self-test',
    );

    expect(readme).toContain('`verify-office-handoff.mjs`');
    expect(readme).toContain('consumes an already extracted exact package entry');
    expect(readme).toContain(
      'renders the request through the local Inkspan Office CLI',
    );
    expect(readme).toContain('does not build, pack, or choose the artifact itself');
    expect(readme).toContain('`verify-packed-office-journey.mjs`');
    expect(readme).toContain('self-contained package-authority wrapper');
    expect(readme).not.toContain(
      'Complete Office-renderer execution and validation also remain pending',
    );
    expect(readme).not.toContain(
      'complete converter/Office execution and validation beyond the bounded request helper',
    );
  });
});
