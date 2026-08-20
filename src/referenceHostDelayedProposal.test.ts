import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/delayed-proposal.mjs',
);

describe('reference-host delayed proposal contract', () => {
  it('ships one deterministic local proposal fixture outside the published runtime', () => {
    expect(existsSync(fixturePath)).toBe(true);
  });

  it('keeps proposal generation provider-free and network-free', () => {
    if (!existsSync(fixturePath)) return;
    const source = readFileSync(fixturePath, 'utf8');

    expect(source).not.toMatch(/(?:from|import\()\s*['"][^'"]*src\//u);
    expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket)\b/u);
    expect(source).toContain('REFERENCE_ONLY');
    expect(source).toContain('expectedRevision');
  });

  it('conflicts stale delayed proposals instead of overwriting newer content', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(process.execPath, [fixturePath, '--self-test'], {
      encoding: 'utf8',
    });

    expect(JSON.parse(output)).toEqual({
      acceptedDocument: 'Accepted proposal',
      acceptedStatus: 'applied',
      staleDocument: 'User typed newer text',
      staleStatus: 'conflict',
    });
  });

  it('rejects accessor-backed untrusted proposal inputs without invoking them', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(
      process.execPath,
      [fixturePath, '--hostile-accessor-self-test'],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      applicationError: 'proposal application is invalid.',
      applicationGetterCalls: 0,
      creationError: 'proposal creation is invalid.',
      creationGetterCalls: 0,
      proposalError: 'proposal application is invalid.',
      proposalGetterCalls: 0,
    });
  });
});
