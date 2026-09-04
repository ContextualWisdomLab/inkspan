import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspacePolicy = readFileSync(
  join(repositoryRoot, 'pnpm-workspace.yaml'),
  'utf8',
);
const workspacePolicyLines = workspacePolicy.split(/\r?\n/u);

function readScalar(
  name: string,
  lines: readonly string[] = workspacePolicyLines,
): string | undefined {
  const prefix = `${name}:`;
  const matches = lines.filter((candidate) => candidate.startsWith(prefix));
  if (matches.length !== 1) return undefined;
  return matches[0]?.slice(prefix.length).split('#', 1)[0]?.trim();
}

describe('pnpm supply-chain policy', () => {
  it('pins security-sensitive install policy instead of relying on mutable defaults', () => {
    expect(readScalar('blockExoticSubdeps')).toBe('true');
    expect(readScalar('minimumReleaseAge')).toBe('10080');
    expect(readScalar('trustPolicy')).toBe('no-downgrade');
    expect(readScalar('trustPolicyIgnoreAfter')).toBe('43200');
  });

  it('rejects duplicate root policy scalars instead of accepting the first declaration', () => {
    expect(
      readScalar('trustPolicy', [
        'trustPolicy: no-downgrade',
        'trustPolicy: always',
      ]),
    ).toBeUndefined();
  });
});
