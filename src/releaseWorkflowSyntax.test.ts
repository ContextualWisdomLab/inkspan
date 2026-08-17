import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8');

describe('release workflow YAML syntax contract', () => {
  it('uses a block scalar for the hash-locked Office install command', () => {
    expect(releaseWorkflow).toMatch(
      /- name: Install hash-locked Office dependencies\n\s+working-directory: office\n\s+run: \|\n\s+python -m pip install --require-hashes --only-binary=:all: -r requirements-ci\.txt/,
    );
    expect(releaseWorkflow).not.toMatch(
      /^\s+run:\s+python .*--only-binary=:all:\s+-r requirements-ci\.txt$/m,
    );
  });
});
