import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('editor placeholder accessibility documentation', () => {
  it('keeps placeholder guidance separate from accessible-name authority', () => {
    const doctoring = repositoryFile(
      'docs/doctoring/editor-placeholder-accessibility.md',
    );

    expect(doctoring).toContain('Status: Implemented on active PR');
    expect(doctoring).toContain('aria-placeholder');
    expect(doctoring).toContain('supplemental guidance');
    expect(doctoring).toContain('aria-labelledby');
    expect(doctoring).toContain(
      'It never promotes the placeholder to `aria-label`',
    );
    expect(doctoring).toContain('WAI-ARIA 1.2');
    expect(doctoring).toContain('World Wide Web Consortium. (2023, June 6).');
  });
});
