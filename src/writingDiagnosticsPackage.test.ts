import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WRITING_DIAGNOSTIC_LIMITS,
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  TextPositionSelectorEvidenceError,
  WritingDiagnosticError,
  WritingDiagnosticProjectionError,
  buildTextProjectionMap,
  resolveTextPositionSelector,
  validateWritingDiagnostics,
} from './writing-diagnostics/index.js';

const repositoryRoot = process.cwd();
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
) as {
  scripts: Record<string, string>;
  exports: Record<
    string,
    string | { types?: string; import?: string; require?: string }
  >;
};

function readRepositoryFile(path: string): string {
  return readFileSync(join(repositoryRoot, path), 'utf8');
}

describe('writing diagnostics package boundary', () => {
  it('exports the strict contract and exact selector-resolution primitives', () => {
    expect(DEFAULT_WRITING_DIAGNOSTIC_LIMITS.maxDiagnostics).toBeGreaterThan(0);
    expect(TEXT_POSITION_PROJECTION_ID).toBe('inkspan-prosemirror-text');
    expect(TEXT_POSITION_PROJECTION_VERSION).toBe(1);
    expect(typeof WritingDiagnosticError).toBe('function');
    expect(typeof WritingDiagnosticProjectionError).toBe('function');
    expect(typeof TextPositionSelectorEvidenceError).toBe('function');
    const evidenceError = new TextPositionSelectorEvidenceError(
      'grapheme_boundary',
    );
    expect(evidenceError).toMatchObject({
      name: 'TextPositionSelectorEvidenceError',
      code: 'grapheme_boundary',
    });
    expect(typeof validateWritingDiagnostics).toBe('function');
    expect(typeof buildTextProjectionMap).toBe('function');
    expect(typeof resolveTextPositionSelector).toBe('function');

    const textNode = Object.freeze({
      isBlock: false,
      isText: true,
      isLeaf: false,
      inlineContent: false,
      text: 'Alpha',
      nodeSize: 5,
    });
    const documentNode = {
      descendants(
        visitor: (node: typeof textNode, position: number) => boolean | void,
      ): void {
        visitor(textNode, 1);
      },
    } as unknown as Parameters<typeof buildTextProjectionMap>[0];
    const projection = buildTextProjectionMap(documentNode);
    expect(projection.text).toBe('Alpha');
    expect(projection.boundaryPositions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      resolveTextPositionSelector(
        documentNode,
        { type: 'TextPositionSelector', start: 0, end: 5 },
        {
          id: TEXT_POSITION_PROJECTION_ID,
          version: TEXT_POSITION_PROJECTION_VERSION,
        },
      ),
    ).toEqual({ from: 1, to: 6 });
  });

  it('publishes one explicit ESM, CommonJS, and declaration export map', () => {
    expect(packageJson.exports['./writing-diagnostics']).toEqual({
      types: './dist/writing-diagnostics/index.d.ts',
      import: './dist/cwl-writing-diagnostics.js',
      require: './dist/cwl-writing-diagnostics.cjs',
    });
    expect(packageJson.scripts.build).toContain(
      'vite build --config vite.writing-diagnostics.config.ts',
    );
    expect(packageJson.scripts['verify:package']).toContain(
      'node ./scripts/verify-writing-diagnostics-subpath-package.mjs',
    );
  });

  it('defines a dual-format declaration build with sourcemaps', () => {
    const configuration = readRepositoryFile(
      'vite.writing-diagnostics.config.ts',
    );
    expect(configuration).toContain("src/writing-diagnostics/index.ts");
    expect(configuration).toContain("'cwl-writing-diagnostics.js'");
    expect(configuration).toContain("'cwl-writing-diagnostics.cjs'");
    expect(configuration).toContain("formats: ['es', 'cjs']");
    expect(configuration).toContain('sourcemap: true');
    expect(configuration).toContain('vite-plugin-dts');
    expect(configuration).not.toMatch(/@vitejs\/plugin-react|from ['"]react|from ['"]yjs/iu);
  });

  it('keeps the public barrel and packed consumer framework-neutral', () => {
    const barrel = readRepositoryFile('src/writing-diagnostics/index.ts');
    expect(barrel).toContain("from '../writingDiagnostics.js'");
    expect(barrel).toContain("from '../writingDiagnosticProjection.js'");
    expect(barrel).toContain("from '../textPositionSelectorEvidence.js'");
    expect(barrel).not.toMatch(
      /(?:@tiptap\/react|react(?:-dom)?|collaboration|yjs|components|extensions|fetch\s*\(|process\.env|import\.meta\.env)/iu,
    );

    const verifier = readRepositoryFile(
      'scripts/verify-writing-diagnostics-subpath-package.mjs',
    );
    for (const requiredEvidence of [
      'consumer.mjs',
      'consumer.cjs',
      'ssr-consumer.mjs',
      'consumer.ts',
      'strict: true',
      'skipLibCheck: false',
      'validateWritingDiagnostics',
      'buildTextProjectionMap',
      'resolveTextPositionSelector',
      'WritingDiagnosticProjectionError',
      'dynamicLoaderPattern',
      'ambientAuthorityPattern',
    ]) {
      expect(verifier).toContain(requiredEvidence);
    }
    expect(verifier).not.toMatch(
      /from ['"](?:react|react-dom|yjs|@tiptap\/react)|require\(['"](?:react|react-dom|yjs|@tiptap\/react)/u,
    );
  });
});
