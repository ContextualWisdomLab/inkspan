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

test('reports CommonJS loader authority reached through require.main', () => {
  const source = [
    "const direct = require.main.require('main-package');",
    "const element = require['main']['require']('element-main-package');",
    "const called = require.main.require.call(undefined, 'call-main-package');",
    'const computed = require.main.require(runtimePackageName);',
    'const object = { main: { require() { return "method-only"; } } };',
    'const benign = object.main.require("not-the-commonjs-loader");',
    'void [direct, element, called, computed, benign];',
  ].join('\n');

  assert.deepEqual(
    findRuntimeModuleAuthority(source, 'require-main-authority.js').map(
      ({ kind, specifier }) => ({ kind, specifier }),
    ),
    [
      { kind: 'commonjs-require', specifier: 'main-package' },
      { kind: 'commonjs-require', specifier: 'element-main-package' },
      { kind: 'commonjs-require', specifier: 'call-main-package' },
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

test('reports statically recognizable indirect CommonJS resolver invocations', () => {
  const source = [
    "const comma = (0, require.resolve)('comma-resolve-package');",
    "const called = require.resolve.call(undefined, 'call-resolve-package');",
    "const elementCalled = require['resolve']['call'](undefined, 'element-call-resolve-package');",
    'const computed = require.resolve.call(undefined, runtimePackageName);',
    'const object = { resolve() { return "method-only"; } };',
    'const benignComma = (0, object.resolve)("not-the-commonjs-resolver");',
    'const benignCall = object.resolve.call(undefined, "also-not-the-commonjs-resolver");',
    'void [comma, called, elementCalled, computed, benignComma, benignCall];',
  ].join('\n');

  assert.deepEqual(
    findRuntimeModuleAuthority(source, 'indirect-resolver-authority.js').map(
      ({ kind, specifier }) => ({ kind, specifier }),
    ),
    [
      { kind: 'commonjs-resolve', specifier: 'comma-resolve-package' },
      { kind: 'commonjs-resolve', specifier: 'call-resolve-package' },
      {
        kind: 'commonjs-resolve',
        specifier: 'element-call-resolve-package',
      },
      { kind: 'commonjs-resolve', specifier: undefined },
    ],
  );
});

test('reports statically recognizable CommonJS apply invocations', () => {
  const source = [
    "const required = require.apply(undefined, ['apply-package']);",
    "const moduleRequired = module['require']['apply'](undefined, ['module-apply-package']);",
    'const mainRequired = require.main.require.apply(undefined, [runtimePackageName]);',
    "const resolved = require.resolve.apply(undefined, ['apply-resolve-package']);",
    'const computedResolved = require[\'resolve\'][\'apply\'](undefined, resolverArguments);',
    'const object = { require() {}, resolve() {} };',
    "const benignRequire = object.require.apply(undefined, ['not-commonjs']);",
    "const benignResolve = object.resolve.apply(undefined, ['not-commonjs-resolve']);",
    'void [required, moduleRequired, mainRequired, resolved, computedResolved, benignRequire, benignResolve];',
  ].join('\n');

  assert.deepEqual(
    findRuntimeModuleAuthority(source, 'apply-authority.js').map(
      ({ kind, specifier }) => ({ kind, specifier }),
    ),
    [
      { kind: 'commonjs-require', specifier: 'apply-package' },
      { kind: 'commonjs-require', specifier: 'module-apply-package' },
      { kind: 'commonjs-require', specifier: undefined },
      { kind: 'commonjs-resolve', specifier: 'apply-resolve-package' },
      { kind: 'commonjs-resolve', specifier: undefined },
    ],
  );
});

test('reports CommonJS authority invoked through Reflect.apply', () => {
  const source = [
    "const required = Reflect.apply(require, undefined, ['reflect-package']);",
    "const moduleRequired = Reflect['apply'](module.require, module, ['reflect-module-package']);",
    'const mainRequired = Reflect.apply(require.main.require, require.main, [runtimePackageName]);',
    "const resolved = Reflect.apply(require.resolve, require, ['reflect-resolve-package']);",
    'const computedResolved = Reflect.apply(require[\'resolve\'], require, resolverArguments);',
    'const object = { require() {}, resolve() {} };',
    "const benignRequire = Reflect.apply(object.require, object, ['not-commonjs']);",
    "const benignResolve = Reflect.apply(object.resolve, object, ['not-commonjs-resolve']);",
    'void [required, moduleRequired, mainRequired, resolved, computedResolved, benignRequire, benignResolve];',
  ].join('\n');

  assert.deepEqual(
    findRuntimeModuleAuthority(source, 'reflect-apply-authority.js').map(
      ({ kind, specifier }) => ({ kind, specifier }),
    ),
    [
      { kind: 'commonjs-require', specifier: 'reflect-package' },
      { kind: 'commonjs-require', specifier: 'reflect-module-package' },
      { kind: 'commonjs-require', specifier: undefined },
      { kind: 'commonjs-resolve', specifier: 'reflect-resolve-package' },
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
