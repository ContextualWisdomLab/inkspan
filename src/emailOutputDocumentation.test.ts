import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository document as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('deterministic email document metadata documentation', () => {
  it('documents full-document language and direction without moving host authority', () => {
    const guide = repositoryFile('docs/email-output.md');

    expect(guide).toContain('Status: Implemented on active PR');
    expect(guide).toContain('languageTag');
    expect(guide).toContain('textDirection');
    expect(guide).toContain('Intl.getCanonicalLocales()');
    expect(guide).toContain('runtime');
    expect(guide).toContain('fragment');
    expect(guide).toContain('host');
    expect(guide).toContain('BCP 47');
    expect(guide).toContain('WCAG 2.2 Technique H57');
    expect(guide).not.toMatch(/Inkspan owns (?:mail )?transport/iu);
  });

  it('records primary standards and the conservative locale-parser claim in APA doctoring', () => {
    const doctoring = repositoryFile(
      'docs/doctoring/email-document-language-direction.md',
    );

    expect(doctoring).toContain('Ecma International. (2026).');
    expect(doctoring).toContain('13th ed.');
    expect(doctoring).toContain('Phillips, A., & Davis, M. (2009).');
    expect(doctoring).toContain('Web Hypertext Application Technology Working Group. (2026).');
    expect(doctoring).toContain('World Wide Web Consortium, Web Accessibility Initiative. (n.d.).');
    expect(doctoring).toContain('conservative');
    expect(doctoring).toContain('grandfathered');
    expect(doctoring).toContain('private-use');
    expect(doctoring).toContain('runtime');
  });
});
