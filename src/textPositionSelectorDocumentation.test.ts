import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const normalizedDocument = (path: string): string =>
  repositoryFile(path).replace(/\s+/gu, ' ').trim();

describe('W3C text-position selector documentation contract', () => {
  it('documents one explicit versioned logical-text projection', () => {
    const lifecycle = normalizedDocument('docs/selection-lifecycle.md');
    const doctoring = normalizedDocument(
      'docs/doctoring/w3c-text-position-selector-evidence.md',
    );

    for (const document of [lifecycle, doctoring]) {
      expect(document).toContain('inkspan-prosemirror-text');
      expect(document).toContain('U+000A');
      expect(document).toContain('U+FFFC');
      expect(document).toContain('Unicode code point');
      expect(document).toContain('grapheme');
      expect(document).toContain('segmenter_unavailable');
    }
  });

  it('keeps W3C evidence revision-scoped and privacy-minimized', () => {
    const lifecycle = normalizedDocument('docs/selection-lifecycle.md');
    const doctoring = normalizedDocument(
      'docs/doctoring/w3c-text-position-selector-evidence.md',
    );

    for (const document of [lifecycle, doctoring]) {
      expect(document).toContain('revision-scoped');
      expect(document).toContain('selected text');
      expect(document).toContain('host');
      expect(document).toMatch(/re-anch/i);
      expect(document).not.toMatch(/W3C[^.]{0,80}(?:authorization|durable write) proof/iu);
    }
  });

  it('records primary standards in APA-style doctoring', () => {
    const doctoring = repositoryFile(
      'docs/doctoring/w3c-text-position-selector-evidence.md',
    );

    expect(doctoring).toContain('World Wide Web Consortium. (2017, February 23).');
    expect(doctoring).toContain('https://www.w3.org/TR/annotation-model/');
    expect(doctoring).toContain('ProseMirror. (n.d.).');
    expect(doctoring).toContain('https://prosemirror.net/docs/ref/');
    expect(doctoring).toContain('Ecma International. (2026).');
    expect(doctoring).toContain('13th ed.');
  });
});
