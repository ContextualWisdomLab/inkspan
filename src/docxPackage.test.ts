import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { importDocx, openDocx } from './docx/index.js';

function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const packageMetadata = JSON.parse(repositoryFile('package.json')) as {
  exports: Record<string, unknown>;
  scripts: Record<string, string>;
};

describe('bounded DOCX import package contract', () => {
  it('exposes the intended source barrel without host-owned authority', () => {
    expect(typeof importDocx).toBe('function');
    expect(typeof openDocx).toBe('function');
  });

  it('declares one independently built ESM CommonJS and TypeScript subpath', () => {
    expect(packageMetadata.exports['./docx']).toEqual({
      types: './dist/docx/index.d.ts',
      import: './dist/cwl-docx.js',
      require: './dist/cwl-docx.cjs',
    });
    expect(packageMetadata.scripts.build).toContain(
      'vite build --config vite.docx.config.ts',
    );
    expect(packageMetadata.scripts['verify:package']).toContain(
      'verify-docx-subpath-package.mjs',
    );
    expect(existsSync(resolve(process.cwd(), 'vite.docx.config.ts'))).toBe(true);
    expect(
      existsSync(resolve(process.cwd(), 'scripts/verify-docx-subpath-package.mjs')),
    ).toBe(true);
  });

  it('keeps the standalone subpath free of host transport, persistence, credential, model, and UI dependencies', () => {
    const sourceFiles = [
      'src/docx/index.ts',
      'src/docx/importDocx.ts',
      'src/docx/ooxml.ts',
      'src/docx/ooxmlHeading.ts',
      'src/docx/ooxmlManifest.ts',
      'src/docx/ooxmlNumberFormats.ts',
      'src/docx/ooxmlNumbering.ts',
      'src/docx/ooxmlPackage.ts',
      'src/docx/ooxmlShared.ts',
      'src/docx/ooxmlStyles.ts',
      'src/docx/xml.ts',
      'src/docx/zip.ts',
    ];
    const forbidden = [
      /\bfetch\s*\(/u,
      /\bXMLHttpRequest\b/u,
      /\bWebSocket\b/u,
      /\bprocess\.env\b/u,
      /\bimport\.meta\.env\b/u,
      /\bindexedDB\b/u,
      /\blocalStorage\b/u,
      /\bsessionStorage\b/u,
      /\bReact\b/u,
      /@tiptap/u,
      /\byjs\b/u,
      /\bnaruon\b/iu,
      /\borchestrator\b/iu,
      /\bopenai\b/iu,
      /\banthropic\b/iu,
    ];
    for (const path of sourceFiles) {
      const source = repositoryFile(path);
      for (const pattern of forbidden) {
        expect(source, `${path} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
