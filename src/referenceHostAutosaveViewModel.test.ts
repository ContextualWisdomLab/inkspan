import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/autosave-view-model.mjs',
);

describe('reference-host autosave presentation contract', () => {
  it('ships one host-owned autosave view-model fixture outside the published runtime', () => {
    expect(existsSync(fixturePath)).toBe(true);
  });

  it('maps programmatic lifecycle state to localization keys without exposing validators', () => {
    if (!existsSync(fixturePath)) return;
    const source = readFileSync(fixturePath, 'utf8');

    expect(source).not.toMatch(/(?:from|import\()\s*['"][^'"]*src\//u);
    expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket)\b/u);
    expect(source).toContain('REFERENCE_ONLY');
    expect(source).toContain('messageKey');
    expect(source).toContain('blockedReason');
    expect(source).not.toContain('document body');
  });

  it('derives clean, saving, queued, conflict, failed, retrying, recovered, closing, and closed states', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(process.execPath, [fixturePath, '--self-test'], {
      encoding: 'utf8',
    });

    expect(JSON.parse(output)).toEqual({
      clean: 'clean',
      closed: 'closed',
      closing: 'closing',
      conflict: 'conflict',
      failed: 'failed',
      queued: 'queued',
      recovered: 'recovered',
      retrying: 'retrying',
      saving: 'saving',
    });
  });
});
