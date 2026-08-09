import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const requiredFiles = [
  'docs/PRD.md',
  'docs/TRD.md',
  'docs/UML.md',
  'docs/DATA_MODEL.md',
  'docs/THREAT_MODEL.md',
  'docs/TEST_STRATEGY.md',
  'docs/OPERABILITY.md',
  'docs/TRACEABILITY.md',
  'docs/adr/README.md',
  'docs/adr/0001-product-host-authority.md',
  'docs/adr/0002-document-revision-authority.md',
  'docs/adr/0003-safe-rich-clipboard.md',
  'docs/adr/0004-durable-validator-autosave.md',
  'docs/adr/0005-revision-scoped-review-evidence.md',
  'docs/adr/0006-ssr-native-form-boundary.md',
  'docs/adr/0007-provider-neutral-collaboration.md',
  'docs/adr/0008-deterministic-office-rendering.md',
  'docs/adr/0009-naruon-modular-composition.md',
  'docs/adr/0010-release-evidence-authority.md',
] as const;

describe('canonical product documentation graph', () => {
  it('keeps the acquisition-critical document graph discoverable', () => {
    for (const path of requiredFiles) {
      expect(existsSync(resolve(process.cwd(), path)), path).toBe(true);
    }
  });

  it('records host ownership and deterministic Inkspan authority consistently', () => {
    const prd = repositoryFile('docs/PRD.md');
    const trd = repositoryFile('docs/TRD.md');
    const threatModel = repositoryFile('docs/THREAT_MODEL.md');
    const operability = repositoryFile('docs/OPERABILITY.md');

    for (const document of [prd, trd, threatModel, operability]) {
      expect(document).toContain('host');
      expect(document).toMatch(/transport|authorization|tenant|persistence/i);
    }
    expect(prd).toContain('deterministic');
    expect(trd).toContain('Protected `main`');
    expect(threatModel).toContain('document bodies');
    expect(operability).toContain('rollback');
  });

  it('documents realistic security, test, and release evidence boundaries', () => {
    const threatModel = repositoryFile('docs/THREAT_MODEL.md');
    const testStrategy = repositoryFile('docs/TEST_STRATEGY.md');
    const traceability = repositoryFile('docs/TRACEABILITY.md');

    expect(threatModel).toContain('clipboard');
    expect(threatModel).toContain('formula');
    expect(threatModel).toContain('Yjs');
    expect(testStrategy).toContain('Chromium');
    expect(testStrategy).toContain('Firefox');
    expect(testStrategy).toContain('WebKit');
    expect(testStrategy).toContain('100%');
    expect(traceability).toContain('RFC 9110');
    expect(traceability).toContain('WCAG 2.2');
    expect(traceability).toContain('Protected `main`');
  });

  it('keeps detailed ADRs indexed and explicit about failure and rollback', () => {
    const index = repositoryFile('docs/adr/README.md');

    for (const path of requiredFiles.filter((path) => /docs\/adr\/\d{4}-/.test(path))) {
      const filename = path.split('/').at(-1);
      expect(filename).toBeDefined();
      expect(index).toContain(filename!);
      const adr = repositoryFile(path);
      expect(adr).toContain('## Context');
      expect(adr).toContain('## Decision');
      expect(adr).toContain('## Consequences');
      expect(adr).toContain('## Failure and recovery');
      expect(adr).toContain('## Verification');
      expect(adr).toContain('## Rollback or supersession');
    }
  });
});
