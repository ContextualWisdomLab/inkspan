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

test('reports executable module authority with actionable specifiers', () => {
  const source = [
    "import value from 'static-package';",
    "export { value as other } from 'reexport-package';",
    "const required = require('commonjs-package');",
    "const lazy = import('dynamic-package');",
    'const unknown = require(runtimePackageName);',
    'void [value, required, lazy, unknown];',
  ].join('\n');

  assert.deepEqual(
    findRuntimeModuleAuthority(source, 'authority.js').map(
      ({ kind, specifier }) => ({ kind, specifier }),
    ),
    [
      { kind: 'static-import', specifier: 'static-package' },
      { kind: 'static-reexport', specifier: 'reexport-package' },
      { kind: 'commonjs-require', specifier: 'commonjs-package' },
      { kind: 'dynamic-import', specifier: 'dynamic-package' },
      { kind: 'commonjs-require', specifier: undefined },
    ],
  );
});

test('fails closed when emitted JavaScript is syntactically invalid', () => {
  assert.throws(
    () => findRuntimeModuleAuthority('const = ;', 'broken.js'),
    /broken\.js is not valid JavaScript/u,
  );
});
