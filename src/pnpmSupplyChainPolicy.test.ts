import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspacePolicy = readFileSync(
  join(repositoryRoot, 'pnpm-workspace.yaml'),
  'utf8',
);

function readScalar(name: string): string | undefined {
  const match = workspacePolicy.match(
    new RegExp(`^${name}:\\s*([^#\\n]+?)\\s*$`, 'mu'),
  );
  return match?.[1];
}

describe('pnpm supply-chain policy', () => {
  it('pins security-sensitive install policy instead of relying on mutable defaults', () => {
    expect(readScalar('blockExoticSubdeps')).toBe('true');
    expect(readScalar('minimumReleaseAge')).toBe('10080');
    expect(readScalar('trustPolicy')).toBe('no-downgrade');
    expect(readScalar('trustPolicyIgnoreAfter')).toBe('43200');
  });
});
