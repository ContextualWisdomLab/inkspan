import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('reference-host Office handoff', () => {
  it('maps bounded editor Markdown through the public React-free projection before creating a DOCX request', () => {
    const source = repositoryFile('examples/reference-host/office-handoff.mjs');

    expect(source).toContain(
      "import { markdownToPlainText } from '@contextualwisdomlab/cwl-editor/markdown';",
    );
    expect(source).toContain('export function createReferenceDocxRequest');
    expect(source).toContain('markdownToPlainText(markdown)');
    expect(source).toContain("format: 'docx'");
    expect(source).toContain("type: 'paragraph'");
  });

  it('keeps Office rendering, authorization, storage, and transport outside the reference helper', () => {
    const source = repositoryFile('examples/reference-host/office-handoff.mjs');

    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('inkspan_office');
    expect(source).not.toContain('child_process');
    expect(source).not.toContain('writeFile');
  });
});
