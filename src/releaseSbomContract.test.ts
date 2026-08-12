import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const workflow = repositoryFile('.github/workflows/release.yml');

describe('release SBOM contract', () => {
  it('signature-verifies the pinned Syft release before generating the SBOM', () => {
    const cosignIndex = workflow.indexOf('- name: Install Cosign');
    const syftInstallIndex = workflow.indexOf(
      '- name: Install signature-verified Syft',
    );
    const generationIndex = workflow.indexOf('- name: Generate release SBOM');
    const validationIndex = workflow.indexOf('- name: Validate release SBOM');

    expect(cosignIndex).toBeGreaterThan(-1);
    expect(syftInstallIndex).toBeGreaterThan(cosignIndex);
    expect(generationIndex).toBeGreaterThan(syftInstallIndex);
    expect(validationIndex).toBeGreaterThan(generationIndex);

    const cosignStep = workflow.slice(cosignIndex, syftInstallIndex);
    expect(cosignStep).toContain(
      'sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6',
    );
    expect(cosignStep).toContain("cosign-release: 'v3.0.6'");

    const syftInstallStep = workflow.slice(syftInstallIndex, generationIndex);
    expect(syftInstallStep).toContain(
      'https://raw.githubusercontent.com/anchore/syft/16223e6dd7893fe578787658ceb876257483d404/install.sh',
    );
    expect(syftInstallStep).toContain('DOWNLOAD_TAG_INSTALL_SCRIPT=false');
    expect(syftInstallStep).toContain(
      'sh "$syft_installer" -v -b "$RUNNER_TEMP/syft-bin" v1.50.0',
    );
    expect(syftInstallStep).toContain('"$RUNNER_TEMP/syft-bin/syft" version');

    const generationStep = workflow.slice(generationIndex, validationIndex);
    expect(generationStep).not.toContain('anchore/sbom-action@');
    expect(generationStep).toContain(
      'syft scan dir:. -o spdx-json > release/inkspan.spdx.json',
    );
  });

  it('generates and validates one deterministic SPDX JSON SBOM before checksums', () => {
    const generationIndex = workflow.indexOf('- name: Generate release SBOM');
    const validationIndex = workflow.indexOf('- name: Validate release SBOM');
    const checksumIndex = workflow.indexOf('- name: Generate release checksums');

    expect(generationIndex).toBeGreaterThan(-1);
    expect(validationIndex).toBeGreaterThan(generationIndex);
    expect(checksumIndex).toBeGreaterThan(validationIndex);

    const generationStep = workflow.slice(generationIndex, validationIndex);
    expect(generationStep).toContain(
      'syft scan dir:. -o spdx-json > release/inkspan.spdx.json',
    );

    const validationStep = workflow.slice(validationIndex, checksumIndex);
    expect(validationStep).toContain('release/inkspan.spdx.json');
    expect(validationStep).toContain('16 * 1024 * 1024');
    expect(validationStep).toContain('SPDX-2.3');
    expect(validationStep).toContain('@contextualwisdomlab/cwl-editor');
    expect(validationStep).toContain('inkspan-office');
    expect(validationStep).toContain('packages');
  });

  it('requires both release package identities to exist in the generated SBOM inventory', () => {
    const validationIndex = workflow.indexOf('- name: Validate release SBOM');
    const checksumIndex = workflow.indexOf('- name: Generate release checksums');
    const validationStep = workflow.slice(validationIndex, checksumIndex);

    expect(validationStep).toContain(
      'const sbomPackageNames = new Set(sbom.packages.map((pkg) => pkg.name));',
    );
    expect(validationStep).toContain(
      'if (!sbomPackageNames.has(packageMetadata.name))',
    );
    expect(validationStep).toContain(
      "if (!sbomPackageNames.has('inkspan-office'))",
    );
  });

  it('checksums, inventories, publishes, and provenance-attests the SBOM asset', () => {
    expect(workflow).toContain('sha256sum -- *.tgz *.whl inkspan.spdx.json > SHA256SUMS');
    expect(workflow).toContain('expected_asset_count=4');
    expect(workflow).toContain('release/inkspan.spdx.json');
    expect(workflow).toContain('one *.tgz, one *.whl, inkspan.spdx.json, and SHA256SUMS');
  });

  it('binds the release packages to the SBOM and verifies the SBOM predicate', () => {
    const sbomAttestIndex = workflow.indexOf('- name: Attest release packages with SBOM');
    const verificationIndex = workflow.indexOf('- name: Verify generated attestations');

    expect(sbomAttestIndex).toBeGreaterThan(-1);
    expect(verificationIndex).toBeGreaterThan(sbomAttestIndex);

    const attestationStep = workflow.slice(sbomAttestIndex, verificationIndex);
    expect(attestationStep).toContain(
      'actions/attest@59d89421af93a897026c735860bf21b6eb4f7b26',
    );
    expect(attestationStep).toContain('release/*.tgz');
    expect(attestationStep).toContain('release/*.whl');
    expect(attestationStep).toContain('sbom-path: release/inkspan.spdx.json');

    const verificationStep = workflow.slice(
      verificationIndex,
      workflow.indexOf('- name: Prepare draft GitHub release', verificationIndex),
    );
    expect(verificationStep).toContain(
      '--predicate-type https://spdx.dev/Document/v2.3',
    );
  });

  it('documents the four-asset release and SBOM digest-verification boundary', () => {
    const releaseSecurity = repositoryFile('docs/release-security.md');

    expect(releaseSecurity).toContain('inkspan.spdx.json');
    expect(releaseSecurity).toContain(
      'exactly one npm `*.tgz`, one Office `*.whl`, `inkspan.spdx.json`, and `SHA256SUMS`',
    );
    expect(releaseSecurity).toContain('SBOM digest');
    expect(releaseSecurity).toContain('signature-verified Syft');
  });
});
