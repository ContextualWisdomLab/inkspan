import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);

test('writing diagnostics is published as an independently built package subpath', () => {
  assert.deepEqual(packageJson.exports['./writing-diagnostics'], {
    types: './dist/writing-diagnostics/index.d.ts',
    import: './dist/cwl-writing-diagnostics.js',
    require: './dist/cwl-writing-diagnostics.cjs',
  });
  assert.match(
    packageJson.scripts.build,
    /vite build --config vite\.writing-diagnostics\.config\.ts/u,
  );
  assert.match(
    packageJson.scripts['verify:package'],
    /verify-writing-diagnostics-subpath-package\.mjs/u,
  );
});
