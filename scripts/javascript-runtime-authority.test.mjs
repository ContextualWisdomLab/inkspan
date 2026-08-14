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

test('reports statically recognizable indirect CommonJS loader invocations', () => {
  const source = [
    "const comma = (0, require)('comma-package');",
    "const called = require.call(undefined, 'call-package');",
    "const moduleRequired = module.require('module-package');",
    "const elementRequired = module['require']('element-package');",
    'const computed = module.require(runtimePackageName);',
    'const object = { require() { return "method-only"; } };',
    'const benign = object.require("not-the-commonjs-loader");',
    'void [comma, called, moduleRequired, elementRequired, computed, benign];',
  ].join('\n');

  assert.deepEqual(
    findRuntimeModuleAuthority(source, 'indirect-authority.js').map(
      ({ kind, specifier }) => ({ kind, specifier }),
    ),
    [
      { kind: 'commonjs-require', specifier: 'comma-package' },
      { kind: 'commonjs-require', specifier: 'call-package' },
      { kind: 'commonjs-require', specifier: 'module-package' },
      { kind: 'commonjs-require', specifier: 'element-package' },
      { kind: 'commonjs-require', specifier: undefined },
    ],
  );
});

test('reports statically recognizable CommonJS resolver authority', () => {
  const source = [
    "const direct = require.resolve('resolve-package');",
    "const element = require['resolve']('element-resolve-package');",
    'const computed = require.resolve(runtimePackageName);',
    'const object = { resolve() { return "method-only"; } };',
    'const benign = object.resolve("not-the-commonjs-resolver");',
    'void [direct, element, computed, benign];',
  ].join('\n');

  assert.deepEqual(
    findRuntimeModuleAuthority(source, 'resolver-authority.js').map(
      ({ kind, specifier }) => ({ kind, specifier }),
    ),
    [
      { kind: 'commonjs-resolve', specifier: 'resolve-package' },
      { kind: 'commonjs-resolve', specifier: 'element-resolve-package' },
      { kind: 'commonjs-resolve', specifier: undefined },
    ],
  );
});

test('fails closed when emitted JavaScript is syntactically invalid', () => {
  assert.throws(
    () => findRuntimeModuleAuthority('const = ;', 'broken.js'),
    /broken\.js is not valid JavaScript/u,
  );
});
