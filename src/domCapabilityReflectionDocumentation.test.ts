import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository document with layout whitespace collapsed. */
function normalizedRepositoryDocument(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
    .replace(/\s+/gu, ' ')
    .trim();
}

describe('DOM capability reflection documentation contract', () => {
  it('binds operator guidance, test-first evidence, and the changelog', () => {
    const operatorGuide = normalizedRepositoryDocument(
      'docs/clipboard-security.md',
    );
    const doctoring = normalizedRepositoryDocument(
      'docs/doctoring/dom-capability-reflection-redaction.md',
    );
    const changelog = normalizedRepositoryDocument('CHANGELOG.md');

    expect(operatorGuide).toContain('## DOM capability failures');
    expect(operatorGuide).toContain(
      'accessors, proxies, revoked proxies, or reflection failures',
    );
    expect(operatorGuide).toContain('fail closed with `dom_unavailable`');
    expect(operatorGuide).toContain(
      'inert-document creation failures remain `dom_unavailable`',
    );
    expect(operatorGuide).toContain(
      'parsing, reconstruction, DOM mutation, or serialization failures remain `invalid_html`',
    );
    expect(operatorGuide).toContain(
      '`docs/doctoring/dom-capability-reflection-redaction.md`',
    );

    expect(doctoring).toContain(
      'RED commit `486846ae88710b87458712cf8da80eb5677cf031`',
    );
    expect(doctoring).toContain('Exact-head CI run `31087687909` failed');
    expect(doctoring).toContain(
      'GREEN commit `e4387658f3b3b936967fd9b0101203dbdc25c55a`',
    );
    expect(doctoring).toContain('ECMAScript® 2026 language specification');
    expect(doctoring).toContain('WHATWG. (2026). *DOM standard*');
    expect(doctoring).toContain('OWASP Foundation. (n.d.).');

    expect(changelog).toContain(
      'Hostile direct-API `Document` accessors, proxies, and revoked proxies now fail closed',
    );
    expect(changelog).toContain(
      'hostile `createElement` and `implementation` property reads cannot leak arbitrary exception text',
    );
  });
});
