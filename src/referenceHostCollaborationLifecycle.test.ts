import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/collaboration-provider-lifecycle.mjs',
);

describe('reference-host collaboration lifecycle contract', () => {
  it('ships one host-owned collaboration lifecycle fixture outside the published runtime', () => {
    expect(existsSync(fixturePath)).toBe(true);
  });

  it('keeps provider creation and teardown host-owned and provider-neutral', () => {
    if (!existsSync(fixturePath)) return;
    const source = readFileSync(fixturePath, 'utf8');

    expect(source).not.toMatch(/(?:from|import\()\s*['"][^'"]*src\//u);
    expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|process\.env)\b/u);
    expect(source).toContain('REFERENCE_ONLY');
    expect(source).toContain('providerFactory');
    expect(source).toContain('reconnect');
    expect(source).toContain('dispose');
  });

  it('reuses one real host-created Y.Doc across provider reconnects and tears it down exactly once', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(process.execPath, [fixturePath, '--self-test'], {
      encoding: 'utf8',
    });

    expect(JSON.parse(output)).toEqual({
      events: [
        'document:create',
        'provider:create:1',
        'provider:connect:1',
        'provider:disconnect:1',
        'provider:destroy:1',
        'provider:create:2',
        'provider:connect:2',
        'provider:disconnect:2',
        'provider:destroy:2',
        'document:destroy',
      ],
      hostDocumentIsYjs: true,
      providerGeneration: 2,
      sameDocumentAcrossReconnect: true,
      status: 'disposed',
      yjsText: 'Buyer draft',
    });
  });

  it('rejects accessor-backed lifecycle options and resource methods without invoking them', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(
      process.execPath,
      [fixturePath, '--hostile-accessor-self-test'],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      documentError: 'documentFactory returned an invalid document.',
      documentGetterCalls: 0,
      optionsError: 'collaboration options are invalid.',
      optionsGetterCalls: 0,
      providerError: 'providerFactory returned an invalid provider.',
      providerGetterCalls: 0,
    });
  });

  it('attempts provider and document cleanup after teardown failure without leaking private causes', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(
      process.execPath,
      [fixturePath, '--cleanup-failure-self-test'],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      error: 'collaboration lifecycle teardown failed.',
      events: [
        'provider:connect',
        'provider:disconnect',
        'provider:destroy',
        'document:destroy',
      ],
      leakedPrivateCause: false,
      status: 'disposed',
    });
  });
});
