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

    expect(nativeFormHost).toContain(
      "from '@contextualwisdomlab/cwl-editor'",
    );
    expect(browserHost).toContain(
      "import '@contextualwisdomlab/cwl-editor/styles.css'",
    );
    expect(nativeFormHost).not.toContain('inkspan-browser-under-test');
    expect(browserHost).not.toContain('inkspan-browser-under-test');

    expect(viteConfig).toContain('INKSPAN_BROWSER_PACKAGE_ENTRY');
    expect(viteConfig).toContain(
      "find: '@contextualwisdomlab/cwl-editor/styles.css'",
    );
    expect(viteConfig).toContain(
      "find: '@contextualwisdomlab/cwl-editor'",
    );
    expect(viteConfig).toContain(
      "resolve(packedPackageRoot, 'dist/cwl-editor.css')",
    );
    expect(viteConfig).toContain('replacement: packageEntry');
  });
});
