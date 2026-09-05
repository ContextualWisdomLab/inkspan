import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('reference-host packed browser binding', () => {
  it('routes the buyer host public package imports through the exact packed release artifact', () => {
    const viteConfig = repositoryFile('tests/browser/vite.config.ts');
    const nativeFormHost = repositoryFile(
      'examples/reference-host/native-form-host.tsx',
    );
    const browserHost = repositoryFile(
      'examples/reference-host/browser-host.tsx',
    );
    const presentationFull = repositoryFile(
      'examples/reference-host/presentation-full.css',
    );

    expect(nativeFormHost).toContain(
      "from '@contextualwisdomlab/cwl-editor'",
    );
    expect(browserHost).toContain("import './presentation-full.css'");
    expect(presentationFull).toContain(
      "@import '@contextualwisdomlab/cwl-editor/styles.css'",
    );
    expect(presentationFull).toContain(
      "@import '@contextualwisdomlab/cwl-editor/fonts.css'",
    );
    expect(nativeFormHost).not.toContain('inkspan-browser-under-test');
    expect(browserHost).not.toContain('inkspan-browser-under-test');

    expect(viteConfig).toContain('INKSPAN_BROWSER_PACKAGE_ENTRY');
    expect(viteConfig).toContain(
      "find: '@contextualwisdomlab/cwl-editor/styles.css'",
    );
    expect(viteConfig).toContain(
      "find: '@contextualwisdomlab/cwl-editor/fonts.css'",
    );
    expect(viteConfig).toContain(
      "find: '@contextualwisdomlab/cwl-editor/fonts-latin.css'",
    );
    expect(viteConfig).toContain(
      "find: '@contextualwisdomlab/cwl-editor'",
    );
    expect(viteConfig).toContain(
      "resolve(packedPackageRoot, 'dist/cwl-editor.css')",
    );
    expect(viteConfig).toContain(
      "resolve(packedPackageRoot, 'src/fonts/fonts.css')",
    );
    expect(viteConfig).toContain(
      "resolve(packedPackageRoot, 'src/fonts/fonts-latin.css')",
    );
    expect(viteConfig).toContain('replacement: packageEntry');
  });

  it('pre-optimizes every browser application entry before parallel Playwright workers can invalidate shared Vite dependency chunks', () => {
    const viteConfig = repositoryFile('tests/browser/vite.config.ts');

    expect(viteConfig).toContain('optimizeDeps: {');
    expect(viteConfig).toContain("'tests/browser/harness.html'");
    expect(viteConfig).toContain(
      "'examples/reference-host/browser-host.html'",
    );
  });

  it('installs packed runtime dependencies and shares one consumer-owned React instance with the host', () => {
    const verifier = repositoryFile('examples/reference-host/verify-browser-journey.mjs');
    const viteConfig = repositoryFile('tests/browser/vite.config.ts');
    expect(verifier).toContain("['install', '--prefer-offline', '--ignore-scripts', '--no-frozen-lockfile']");
    expect(verifier).toContain('file:${tarballPath}');
    expect(verifier).toContain('installedDependencyClosure: true');
    expect(viteConfig).toContain("['react', 'react-dom']");
    expect(viteConfig).toContain('packageRequire.resolve(`${peerName}/package.json`)');
    expect(viteConfig).toContain('strict: true');
    expect(viteConfig).toContain('allow: [repositoryRoot, ...(packedPackageRoot ? [packedPackageRoot] : [])]');
  });
});
