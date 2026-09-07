import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one repository document and normalize layout whitespace. */
function normalizedDocument(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
    .replace(/\s+/gu, ' ')
    .trim();
}

describe('clipboard resource-preflight documentation contract', () => {
  it('tells hosts how to respond to size and node-limit rejections', () => {
    const operatorGuide = normalizedDocument('docs/clipboard-security.md');
    const doctoring = normalizedDocument(
      'docs/doctoring/clipboard-resource-preflight.md',
    );
    const changelog = normalizedDocument('CHANGELOG.md');

    expect(operatorGuide).toContain(
      'raise the matching ceiling only after measuring a trusted source',
    );
    expect(operatorGuide).toContain(
      'UTF-16 code-unit length already exceeds `maxHtmlBytes`',
    );
    expect(operatorGuide).toContain(
      'before materializing those children',
    );
    expect(operatorGuide).toContain(
      'The machine-readable error codes remain stable, while customer-facing rejection messages give a bounded next action',
    );
    expect(doctoring).toContain(
      'preserve the stable error codes while allowing the customer-facing messages to remain actionable',
    );
    expect(doctoring).toContain('Unicode Standard');
    expect(doctoring).toContain('CWE-770');
    expect(doctoring).toContain('https://www.unicode.org/versions/Unicode16.0.0/');
    expect(doctoring).toContain(
      'https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/',
    );
    expect(changelog).toContain(
      'Reject obviously oversized rich clipboard HTML from UTF-16 code-unit length',
    );
    expect(changelog).toContain(
      'before materializing children beyond `maxNodes`',
    );
  });
});
