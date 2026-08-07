import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const workflow = repositoryFile('.github/workflows/release.yml');

describe('release draft asset inventory contract', () => {
  it('rejects an unexpected local artifact before attestation or upload', () => {
    const localValidationIndex = workflow.indexOf(
      '- name: Verify bounded local release artifact set',
    );
    const attestIndex = workflow.indexOf('- name: Attest release artifacts');
    const uploadIndex = workflow.indexOf('gh release upload "$GITHUB_REF_NAME"');

    expect(localValidationIndex).toBeGreaterThan(-1);
    expect(attestIndex).toBeGreaterThan(localValidationIndex);
    expect(uploadIndex).toBeGreaterThan(attestIndex);

    const localValidationStep = workflow.slice(
      localValidationIndex,
      attestIndex,
    );
    expect(localValidationStep).toContain('expected_asset_count=3');
    expect(localValidationStep).toContain('*.tgz');
    expect(localValidationStep).toContain('*.whl');
    expect(localValidationStep).toContain('SHA256SUMS');
    expect(localValidationStep).toContain(
      'Unexpected local release artifact set',
    );
  });

  it('validates the exact uploaded draft inventory before publishing', () => {
    const uploadIndex = workflow.indexOf('gh release upload "$GITHUB_REF_NAME"');
    const inventoryIndex = workflow.indexOf(
      '- name: Verify exact draft release asset inventory',
    );
    const publishIndex = workflow.indexOf(
      'gh release edit "$GITHUB_REF_NAME"',
    );

    expect(uploadIndex).toBeGreaterThan(-1);
    expect(inventoryIndex).toBeGreaterThan(uploadIndex);
    expect(publishIndex).toBeGreaterThan(inventoryIndex);

    const inventoryStep = workflow.slice(inventoryIndex, publishIndex);
    expect(inventoryStep).toContain('gh api');
    expect(inventoryStep).toContain('--paginate');
    expect(inventoryStep).toContain('--slurp');
    expect(inventoryStep).toContain(
      'repos/$GITHUB_REPOSITORY/releases?per_page=100',
    );
    expect(inventoryStep).toContain('select(.tag_name == $tag)');
    expect(inventoryStep).not.toContain(
      'releases/tags/$GITHUB_REF_NAME',
    );
    expect(inventoryStep).toContain('Expected exactly one draft release for tag');
    expect(inventoryStep).toContain("release_state='.draft'");
    expect(inventoryStep).toContain("asset_state='.assets[].state'");
    expect(inventoryStep).toContain("asset_digest='.assets[].digest'");
    expect(inventoryStep).toContain('sha256sum --');
    expect(inventoryStep).toContain('Unexpected draft release asset inventory');
    expect(inventoryStep).toContain('Draft release asset digest mismatch');
  });

  it('admits only the expected npm, wheel, and checksum artifact set', () => {
    const inventoryIndex = workflow.indexOf(
      '- name: Verify exact draft release asset inventory',
    );
    const publishIndex = workflow.indexOf(
      'gh release edit "$GITHUB_REF_NAME"',
    );
    const inventoryStep = workflow.slice(inventoryIndex, publishIndex);

    expect(inventoryStep).toContain('expected_asset_count=3');
    expect(inventoryStep).toContain('*.tgz');
    expect(inventoryStep).toContain('*.whl');
    expect(inventoryStep).toContain('SHA256SUMS');
    expect(inventoryStep).toContain('Unexpected local release artifact set');
    expect(inventoryStep).toContain("asset_name='.assets[].name'");
  });

  it('documents fail-closed stale-draft handling and provenance scope', () => {
    const releaseSecurity = repositoryFile('docs/release-security.md');
    const changelog = repositoryFile('CHANGELOG.md');

    expect(releaseSecurity).toContain('exact draft asset inventory');
    expect(releaseSecurity).toContain('unexpected stale asset');
    expect(releaseSecurity).toContain('before the draft is published');
    expect(releaseSecurity).toContain('sha256:');
    expect(releaseSecurity).toContain('List releases');
    expect(changelog).toContain('draft release asset inventory');
  });
});
