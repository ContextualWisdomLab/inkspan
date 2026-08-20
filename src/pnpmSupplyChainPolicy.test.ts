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

function readScalar(name: string): string | undefined {
  const prefix = `${name}:`;
  const line = workspacePolicyLines.find((candidate) =>
    candidate.startsWith(prefix),
  );
  if (line === undefined) return undefined;
  return line.slice(prefix.length).split('#', 1)[0]?.trim();
}

describe('pnpm supply-chain policy', () => {
  it('pins security-sensitive install policy instead of relying on mutable defaults', () => {
    expect(readScalar('blockExoticSubdeps')).toBe('true');
    expect(readScalar('minimumReleaseAge')).toBe('10080');
    expect(readScalar('trustPolicy')).toBe('no-downgrade');
    expect(readScalar('trustPolicyIgnoreAfter')).toBe('43200');
  });
});
