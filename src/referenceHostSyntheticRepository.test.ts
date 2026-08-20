import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/synthetic-document-repository.mjs',
);

describe('reference-host synthetic durable repository contract', () => {
  it('ships one executable reference-only repository fixture outside the published runtime', () => {
    expect(existsSync(fixturePath)).toBe(true);
  });

  it('keeps the host persistence fixture source-independent and network-free', () => {
    if (!existsSync(fixturePath)) return;
    const source = readFileSync(fixturePath, 'utf8');

    expect(source).not.toMatch(/(?:from|import\()\s*['"][^'"]*src\//u);
    expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket)\b/u);
    expect(source).toContain('REFERENCE_ONLY');
    expect(source).toContain('If-Match');
  });

  it('proves ambiguous failure cannot advance the validator and stale writes conflict', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(process.execPath, [fixturePath, '--self-test'], {
      encoding: 'utf8',
    });

    expect(JSON.parse(output)).toEqual({
      afterAmbiguousValidator: '"v1"',
      conflictCurrentValidator: '"v2"',
      finalDocument: 'Buyer draft v2',
      finalValidator: '"v2"',
      initialValidator: '"v1"',
      savedValidator: '"v2"',
    });
  });
});
