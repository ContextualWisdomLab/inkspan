import assert from 'node:assert/strict';
import test from 'node:test';

import { findRuntimeModuleAuthority } from './javascript-runtime-authority.mjs';

test('ignores loader-shaped text in comments and string literals', () => {
  const source = [
    '/* call require("domino") before constructing the parser */',
    '// import("comment-only")',
    'const first = "require(\\"string-only\\")";',
    "const second = 'import(\\\"also-string-only\\\")';",
    'const third = `require("template-only")`;',
    'const object = { require() { return "method-only"; } };',
    'object.require("not-the-commonjs-loader");',
  ].join('\n');

  assert.deepEqual(findRuntimeModuleAuthority(source, 'benign.js'), []);
});

test('finds executable static and dynamic module authority', () => {
  const source = [
    "import value from 'static-package';",
    "export { value as other } from 'reexport-package';",
    "const required = require('commonjs-package');",
    "const lazy = import('dynamic-package');",
    'void [value, required, lazy];',
  ].join('\n');

  assert.deepEqual(
    findRuntimeModuleAuthority(source, 'authority.js').map(({ kind }) => kind),
    [
      'static-import',
      'static-reexport',
      'commonjs-require',
      'dynamic-import',
    ],
  );
});

test('fails closed when emitted JavaScript is syntactically invalid', () => {
  assert.throws(
    () => findRuntimeModuleAuthority('const = ;', 'broken.js'),
    /broken\.js is not valid JavaScript/u,
  );
});
