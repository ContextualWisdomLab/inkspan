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
const manifest = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
) as { devDependencies?: Record<string, string> };

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

  it('pins the patched development dependency floors', () => {
    expect(workspacePolicy).toContain('fast-uri: ^3.1.8');
    expect(workspacePolicy).toContain('brace-expansion: ^5.0.12');
    expect(manifest.devDependencies?.vitest).toBe('^4.1.11');
    expect(manifest.devDependencies?.['@vitest/coverage-v8']).toBe('^4.1.11');
  });
});
