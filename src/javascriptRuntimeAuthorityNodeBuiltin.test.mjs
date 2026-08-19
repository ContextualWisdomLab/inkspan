import { describe, expect, it } from 'vitest';

import { findRuntimeModuleAuthority } from '../scripts/javascript-runtime-authority.mjs';

describe('Node built-in runtime module authority', () => {
  it('reports statically recognizable process.getBuiltinModule calls', () => {
    const source = [
      "const fs = process.getBuiltinModule('node:fs');",
      "const path = globalThis.process.getBuiltinModule('node:path');",
      'const unknown = process.getBuiltinModule(runtimeBuiltinName);',
      'const object = { getBuiltinModule() { return "method-only"; } };',
      'const benign = object.getBuiltinModule("node:crypto");',
      'void [fs, path, unknown, benign];',
    ].join('\n');

    expect(
      findRuntimeModuleAuthority(source, 'node-builtins.js').map(
        ({ kind, specifier }) => ({ kind, specifier }),
      ),
    ).toEqual([
      { kind: 'node-builtin-module', specifier: 'node:fs' },
      { kind: 'node-builtin-module', specifier: 'node:path' },
      { kind: 'node-builtin-module', specifier: undefined },
    ]);
  });

  it('reports direct Function.prototype.call invocation of the ambient loader', () => {
    const source = [
      "const fs = process.getBuiltinModule.call(undefined, 'node:fs');",
      'const path = globalThis.process.getBuiltinModule.call(null, runtimeBuiltinName);',
      'const object = { getBuiltinModule() { return "method-only"; } };',
      'const benign = object.getBuiltinModule.call(null, "node:crypto");',
      'void [fs, path, benign];',
    ].join('\n');

    expect(
      findRuntimeModuleAuthority(source, 'node-builtins-call.js').map(
        ({ kind, specifier }) => ({ kind, specifier }),
      ),
    ).toEqual([
      { kind: 'node-builtin-module', specifier: 'node:fs' },
      { kind: 'node-builtin-module', specifier: undefined },
    ]);
  });
});
