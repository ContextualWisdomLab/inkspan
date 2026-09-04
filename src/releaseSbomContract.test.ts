import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const workflow = repositoryFile('.github/workflows/release.yml');

describe('release SBOM contract', () => {
  it('signature-verifies the pinned Syft release before scanning exact packages', () => {
    const cosignIndex = workflow.indexOf('- name: Install Cosign');
    const syftInstallIndex = workflow.indexOf(
      '- name: Install signature-verified Syft',
    );
    const generationIndex = workflow.indexOf(
      '- name: Generate exact-package release SBOMs',
    );
    const validationIndex = workflow.indexOf(
      '- name: Validate exact-package release SBOMs',
    );

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
  });

  it('documents the five-asset package-specific SBOM boundary', () => {
    const contracts = repositoryFile('docs/CONTRACTS.md');
    const releaseSecurity = repositoryFile('docs/release-security.md');

    for (const source of [contracts, releaseSecurity]) {
      expect(source).toContain('editor-package.spdx.json');
      expect(source).toContain('office-package.spdx.json');
      expect(source).toContain('exactly five');
    }
    expect(releaseSecurity).toContain('matching SBOM predicate');
    expect(releaseSecurity).toContain('signature-verified Syft');
  });
});
