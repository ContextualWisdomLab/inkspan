import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/synthetic-document-repository.mjs',
);
const guidePath = resolve(process.cwd(), 'examples/reference-host/README.md');

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

  it('proves failure-safe retry, restore, fork isolation, and stale-write conflict semantics', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(process.execPath, [fixturePath, '--self-test'], {
      encoding: 'utf8',
    });

    expect(JSON.parse(output)).toEqual({
      afterAmbiguousValidator: '"v1"',
      afterFailureValidator: '"v2"',
      conflictCurrentValidator: '"v2"',
      forkDocument: 'Buyer draft v1',
      forkFinalDocument: 'Fork-only edit',
      forkInitialValidator: '"v1"',
      forkSavedValidator: '"v2"',
      initialValidator: '"v1"',
      restoredValidator: '"v4"',
      retrySavedValidator: '"v3"',
      savedValidator: '"v2"',
      sourceDocumentAfterFork: 'Buyer draft v1',
      sourceValidatorAfterFork: '"v4"',
    });
  });

  it('fails closed without invoking caller-owned option, save, or fork-request accessors', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(
      process.execPath,
      [fixturePath, '--hostile-accessor-self-test'],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      forkErrorCode: 'invalid_fork_request',
      forkGetterCalls: 0,
      optionErrorCode: 'invalid_options',
      optionGetterCalls: 0,
      requestErrorCode: 'invalid_request',
      requestGetterCalls: 0,
    });
  });

  it('keeps the buyer guide code-current for retry, restore, and independent fork semantics', () => {
    const guide = readFileSync(guidePath, 'utf8');

    expect(guide).toContain(
      'A confirmed failure can be retried with the unchanged current validator.',
    );
    expect(guide).toContain(
      'A restore is a normal confirmed save against the current validator and advances it only after success.',
    );
    expect(guide).toContain(
      'A fork requires the current validator, copies the current document into an independent reference repository, and starts that fork at a fresh validator.',
    );
  });
});
