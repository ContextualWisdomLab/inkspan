import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/ci.yml'),
  'utf8',
);

const CHECKOUT_PIN =
  'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1';

describe('exact-head CI workflow contract', () => {
  it('uses a fixed runner and checks out the immutable current PR head', () => {
    expect(workflow).not.toContain('ubuntu-latest');
    expect(workflow.match(/runs-on: ubuntu-24\.04/g)).toHaveLength(2);
    expect(workflow.match(new RegExp(CHECKOUT_PIN, 'g'))).toHaveLength(2);
    expect(
      workflow.match(
        /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/g,
      ),
    ).toHaveLength(2);
    expect(workflow.match(/persist-credentials: false/g)).toHaveLength(2);
  });

  it('keeps the workflow read-only and hash-pins every third-party action', () => {
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).not.toContain('contents: write');

    const usesLines = workflow
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- uses:'));
    expect(usesLines.length).toBeGreaterThan(0);
    for (const line of usesLines) {
      expect(line).toMatch(/@[0-9a-f]{40}(?:\s+#\s+v[^\s]+)?$/u);
    }
  });
});
