import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('reference-host public presentation assets', () => {
  it('wires editor styles plus the complete multilingual font option through public package subpaths', () => {
    const source = repositoryFile('examples/reference-host/presentation-full.css');

    expect(source).toBe(
      "@import '@contextualwisdomlab/cwl-editor/styles.css';\n" +
        "@import '@contextualwisdomlab/cwl-editor/fonts.css';\n",
    );
  });

  it('wires editor styles plus the smaller Latin font option through public package subpaths', () => {
    const source = repositoryFile('examples/reference-host/presentation-latin.css');

    expect(source).toBe(
      "@import '@contextualwisdomlab/cwl-editor/styles.css';\n" +
        "@import '@contextualwisdomlab/cwl-editor/fonts-latin.css';\n",
    );
  });

  it('runs the real browser host through the complete multilingual presentation entrypoint', () => {
    const source = repositoryFile('examples/reference-host/browser-host.tsx');

    expect(source).toContain("import './presentation-full.css';");
    expect(source).not.toContain(
      "import '@contextualwisdomlab/cwl-editor/styles.css';",
    );
  });

  it('keeps every referenced presentation entrypoint in the published package export map', () => {
    const packageMetadata = JSON.parse(repositoryFile('package.json')) as {
      exports: Record<string, unknown>;
    };

    expect(packageMetadata.exports).toHaveProperty('./styles.css');
    expect(packageMetadata.exports).toHaveProperty('./fonts.css');
    expect(packageMetadata.exports).toHaveProperty('./fonts-latin.css');
  });
});