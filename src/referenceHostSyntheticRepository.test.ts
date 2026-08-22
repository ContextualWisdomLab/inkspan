import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
      forkInitialValidator: '"f1-v1"',
      forkSavedValidator: '"f1-v2"',
      initialValidator: '"v1"',
      restoredValidator: '"v4"',
      retrySavedValidator: '"v3"',
      savedValidator: '"v2"',
      sourceDocumentAfterFork: 'Buyer draft v1',
      sourceValidatorAfterFork: '"v4"',
    });
  });

  it('gives an immediate fork validator authority distinct from its unchanged source', () => {
    if (!existsSync(fixturePath)) return;
    const fixtureUrl = pathToFileURL(fixturePath).href;
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { createSyntheticDocumentRepository } from ${JSON.stringify(fixtureUrl)};
const source = createSyntheticDocumentRepository({
  documentId: 'buyer-document',
  initialDocument: 'Buyer draft v1',
});
const sourceInitial = source.read('buyer-document');
const forked = source.fork({
  documentId: 'buyer-document',
  forkDocumentId: 'buyer-document-fork',
  ifMatch: sourceInitial.validator,
});
const forkInitial = forked.repository.read('buyer-document-fork');
process.stdout.write(JSON.stringify({
  forkValidator: forkInitial.validator,
  sourceValidator: sourceInitial.validator,
}));`,
      ],
      { encoding: 'utf8' },
    );
    const evidence = JSON.parse(output) as {
      forkValidator: string;
      sourceValidator: string;
    };

    expect(evidence.forkValidator).not.toBe(evidence.sourceValidator);
  });

  it('accepts an empty document body while keeping document identifiers non-empty', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(
      process.execPath,
      [fixturePath, '--empty-document-self-test'],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      clearedDocument: '',
      clearedValidator: '"v2"',
      emptyDocumentIdError: 'invalid_document_id',
      initialEmptyDocument: '',
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

  it('fails closed on unknown option, save, and fork fields before durable state changes', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(
      process.execPath,
      [fixturePath, '--unknown-field-self-test'],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      forkErrorCode: 'invalid_fork_request',
      optionErrorCode: 'invalid_options',
      saveErrorCode: 'invalid_request',
      savedDocument: 'Buyer draft v1',
      savedValidator: '"v1"',
    });
  });

  it('keeps the buyer guide code-current for retry, ambiguity reconciliation, restore, and independent fork semantics', () => {
    const guide = readFileSync(guidePath, 'utf8');

    expect(guide).toContain(
      'A confirmed failure can be retried with the unchanged current validator.',
    );
    expect(guide).toContain(
      '`ambiguous_failure` models a pre-commit failure, while `ambiguous_commit_failure` commits durable state but returns the same ambiguous error without a replacement validator.',
    );
    expect(guide).toContain(
      'After either ambiguous outcome, re-read durable state before retrying instead of advancing or blindly reusing the caller\'s last known validator.',
    );
    expect(guide).toContain(
      'A restore is a normal confirmed save against the current validator and advances it only after success.',
    );
    expect(guide).toContain(
      'A fork requires the current validator, copies the current document into an independent reference repository, and starts that fork at a fresh validator.',
    );
  });
});
