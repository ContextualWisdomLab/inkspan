import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
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

  it('maps programmatic lifecycle transitions to localization keys without exposing validators', () => {
    if (!existsSync(fixturePath)) return;
    const source = readFileSync(fixturePath, 'utf8');

    expect(source).not.toMatch(/(?:from|import\()\s*['"][^'"]*src\//u);
    expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket)\b/u);
    expect(source).toContain('REFERENCE_ONLY');
    expect(source).toContain('messageKey');
    expect(source).toContain('blockedReason');
    expect(source).toContain('observe');
    expect(source).not.toContain('recoveryPhase');
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

  it('does not claim recovery unless a retrying save was observed', () => {
    if (!existsSync(fixturePath)) return;
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createAutosaveViewModel } from ${moduleUrl};
      const snapshot = (state, blockedReason = null) => ({
        state,
        blockedReason,
        activeStrongEntityTag: null,
        pendingStrongEntityTag: null,
        lastSavedStrongEntityTag: null,
      });
      const viewModel = createAutosaveViewModel();
      const blocked = viewModel.observe(snapshot('blocked', 'conflict')).viewState;
      const idleWithoutRetry = viewModel.observe(snapshot('idle')).viewState;
      process.stdout.write(JSON.stringify({ blocked, idleWithoutRetry }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      blocked: 'conflict',
      idleWithoutRetry: 'clean',
    });
  });

  it('rejects empty non-null validator fields instead of treating them as lifecycle evidence', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(
      process.execPath,
      [fixturePath, '--invalid-validator-self-test'],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      activeError: 'activeStrongEntityTag is invalid.',
      lastSavedError: 'lastSavedStrongEntityTag is invalid.',
      pendingError: 'pendingStrongEntityTag is invalid.',
    });
  });

  it('bounds non-null validator fields before projecting autosave state', () => {
    if (!existsSync(fixturePath)) return;
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createAutosaveViewModel } from ${moduleUrl};
      const oversized = 'x'.repeat(257);
      const candidate = {
        state: 'saving',
        blockedReason: null,
        activeStrongEntityTag: null,
        pendingStrongEntityTag: null,
        lastSavedStrongEntityTag: null,
      };
      const errors = {};
      for (const field of [
        'activeStrongEntityTag',
        'pendingStrongEntityTag',
        'lastSavedStrongEntityTag',
      ]) {
        try {
          createAutosaveViewModel().observe({ ...candidate, [field]: oversized });
          errors[field] = null;
        } catch (error) {
          errors[field] = error instanceof Error ? error.message : 'unexpected error';
        }
      }
      process.stdout.write(JSON.stringify(errors));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      activeStrongEntityTag: 'activeStrongEntityTag is invalid.',
      pendingStrongEntityTag: 'pendingStrongEntityTag is invalid.',
      lastSavedStrongEntityTag: 'lastSavedStrongEntityTag is invalid.',
    });
  });

  it('rejects weak and malformed values labeled as strong entity tags', () => {
    if (!existsSync(fixturePath)) return;
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createAutosaveViewModel } from ${moduleUrl};
      const candidate = {
        state: 'saving',
        blockedReason: null,
        activeStrongEntityTag: null,
        pendingStrongEntityTag: null,
        lastSavedStrongEntityTag: null,
      };
      const candidates = [
        ['weak', 'W/"weak"'],
        ['unquoted', 'opaque'],
        ['embeddedQuote', '"bad"quote"'],
        ['control', '"line\\nbreak"'],
        ['nonOctet', '"😀"'],
      ];
      const errors = {};
      for (const [name, value] of candidates) {
        try {
          createAutosaveViewModel().observe({
            ...candidate,
            activeStrongEntityTag: value,
          });
          errors[name] = null;
        } catch (error) {
          errors[name] = error instanceof Error ? error.message : 'unexpected error';
        }
      }
      process.stdout.write(JSON.stringify(errors));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      weak: 'activeStrongEntityTag is invalid.',
      unquoted: 'activeStrongEntityTag is invalid.',
      embeddedQuote: 'activeStrongEntityTag is invalid.',
      control: 'activeStrongEntityTag is invalid.',
      nonOctet: 'activeStrongEntityTag is invalid.',
    });
  });

  it('rejects accessor-backed lifecycle snapshots without invoking them', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(
      process.execPath,
      [fixturePath, '--hostile-accessor-self-test'],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      error: 'autosave snapshot is invalid.',
      getterCalls: 0,
    });
  });
});
