import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspacePolicy = readFileSync(
  join(repositoryRoot, 'pnpm-workspace.yaml'),
  'utf8',
);

function readScalar(name) {
  const match = workspacePolicy.match(
    new RegExp(`^${name}:\\s*([^#\\n]+?)\\s*$`, 'mu'),
  );
  return match?.[1];
}

test('pins the pnpm supply-chain policy instead of relying on mutable defaults', () => {
  assert.equal(readScalar('blockExoticSubdeps'), 'true');
  assert.equal(readScalar('minimumReleaseAge'), '10080');
  assert.equal(readScalar('trustPolicy'), 'no-downgrade');
});
