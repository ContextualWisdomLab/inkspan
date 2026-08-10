import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const workflow = repositoryFile('.github/workflows/release.yml');

describe('release SBOM contract', () => {
  it('generates and validates one deterministic SPDX JSON SBOM before checksums', () => {
    const generationIndex = workflow.indexOf('- name: Generate release SBOM');
    const validationIndex = workflow.indexOf('- name: Validate release SBOM');
    const checksumIndex = workflow.indexOf('- name: Generate release checksums');

    expect(generationIndex).toBeGreaterThan(-1);
    expect(validationIndex).toBeGreaterThan(generationIndex);
    expect(checksumIndex).toBeGreaterThan(validationIndex);

    const generationStep = workflow.slice(generationIndex, validationIndex);
    expect(generationStep).toContain(
      'anchore/sbom-action@fbfd9c6c189226748411491745178e0c2017392d',
    );
    expect(generationStep).toContain('path: .');
    expect(generationStep).toContain('format: spdx-json');
    expect(generationStep).toContain('output-file: release/inkspan.spdx.json');
    expect(generationStep).toContain('upload-artifact: false');
    expect(generationStep).toContain('upload-release-assets: false');

    const validationStep = workflow.slice(validationIndex, checksumIndex);
    expect(validationStep).toContain('release/inkspan.spdx.json');
    expect(validationStep).toContain('@contextualwisdomlab/cwl-editor');
    expect(validationStep).toContain('inkspan-office');
    expect(validationStep).toContain('packages');
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
});
