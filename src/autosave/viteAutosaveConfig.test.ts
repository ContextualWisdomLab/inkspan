// @vitest-environment node

import { resolve } from 'node:path';
import type { LibraryOptions, UserConfig } from 'vite';
import { describe, expect, it } from 'vitest';

import autosaveBuildConfig from '../../vite.autosave.config';

describe('framework-free autosave build configuration', () => {
  it('pins the standalone entry and deterministic ESM/CommonJS outputs', () => {
    const config = autosaveBuildConfig as UserConfig;
    const library = config.build?.lib as LibraryOptions;

    expect(config.build?.emptyOutDir).toBe(false);
    expect(config.build?.sourcemap).toBe(true);
    expect(library.entry).toBe(
      resolve(process.cwd(), 'src/autosave/package.ts'),
    );
    expect(library.name).toBe('InkspanAutosave');
    expect(library.formats).toEqual(['es', 'cjs']);

    const fileName = library.fileName;
    expect(typeof fileName).toBe('function');
    if (typeof fileName !== 'function') {
      throw new Error('autosave package fileName must be a function');
    }
    expect(fileName('es', 'autosave')).toBe('cwl-autosave.js');
    expect(fileName('cjs', 'autosave')).toBe('cwl-autosave.cjs');
  });

  it('keeps declaration generation bounded to the framework-free surface', () => {
    const config = autosaveBuildConfig as UserConfig;
    const declarationPlugin = config.plugins?.[0];

    expect(declarationPlugin).toBeDefined();
    expect(config.plugins).toHaveLength(1);
  });
});
