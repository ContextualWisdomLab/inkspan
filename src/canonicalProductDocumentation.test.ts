import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const requiredFiles = [
  'AGENTS.md',
  'CLAUDE.md',
  'ARCHITECTURE.md',
  'CHANGELOG.md',
  'docs/README.md',
  'docs/PRD.md',
  'docs/TRD.md',
  'docs/CONTRACTS.md',
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

  it('keeps contributor guidance aligned with the canonical documentation spine', () => {
    const agents = repositoryFile('AGENTS.md');
    const claude = repositoryFile('CLAUDE.md');
    const index = repositoryFile('docs/README.md');

    for (const document of [agents, claude]) {
      expect(document).toContain('docs/README.md');
      expect(document).toContain('Protected `main`');
      expect(document).toContain('docs/PRD.md');
      expect(document).toContain('docs/TRD.md');
      expect(document).toContain('docs/CONTRACTS.md');
    }
    for (const marker of [
      '../ARCHITECTURE.md',
      'PRD.md',
      'TRD.md',
      'CONTRACTS.md',
      'UML.md',
      'DATA_MODEL.md',
      'THREAT_MODEL.md',
      'TEST_STRATEGY.md',
      'OPERABILITY.md',
      'TRACEABILITY.md',
      'adr/README.md',
    ]) {
      expect(index).toContain(marker);
    }
  });

  it('records host ownership and deterministic Inkspan authority consistently', () => {
    const prd = repositoryFile('docs/PRD.md');
    const trd = repositoryFile('docs/TRD.md');
    const contracts = repositoryFile('docs/CONTRACTS.md');
    const threatModel = repositoryFile('docs/THREAT_MODEL.md');
    const operability = repositoryFile('docs/OPERABILITY.md');

    for (const document of [prd, trd, contracts, threatModel, operability]) {
      expect(document).toContain('host');
      expect(document).toMatch(/transport|authorization|tenant|persistence/i);
    }
    expect(prd).toContain('deterministic');
    expect(trd).toContain('Protected `main`');
    expect(threatModel).toContain('document bodies');
    expect(operability).toContain('rollback');
  });

  it('preserves the durable product decisions from the canonical conversation', () => {
    const prd = repositoryFile('docs/PRD.md');
    const trd = repositoryFile('docs/TRD.md');
    const contracts = repositoryFile('docs/CONTRACTS.md');
    const uml = repositoryFile('docs/UML.md');
    const dataModel = repositoryFile('docs/DATA_MODEL.md');

    for (const marker of ['Markdown', 'HTML', 'Office', 'naruon', 'provider-neutral']) {
      expect(prd).toContain(marker);
    }
    for (const marker of ['network-free', 'macro-free', 'formula', 'Office']) {
      expect(trd).toContain(marker);
    }
    for (const marker of [
      'document envelope',
      'autosave',
      'collaboration',
      'naruon',
      'host-owned',
      'versioned',
    ]) {
      expect(contracts).toContain(marker);
    }
    for (const marker of ['Office', 'naruon', 'Yjs', 'file publication']) {
      expect(uml).toContain(marker);
    }
    for (const marker of [
      'conversion_request',
      'conversion_artifact',
      'render_warning',
      'host_capability',
      'audit_event',
    ]) {
      expect(dataModel).toContain(marker);
    }
  });

  it('documents realistic security, test, and release evidence boundaries', () => {
    const threatModel = repositoryFile('docs/THREAT_MODEL.md');
    const testStrategy = repositoryFile('docs/TEST_STRATEGY.md');
    const traceability = repositoryFile('docs/TRACEABILITY.md');
    const contracts = repositoryFile('docs/CONTRACTS.md');

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
    expect(contracts).toContain('No secret');
    expect(contracts).toContain('No database');
    expect(contracts).toContain('degraded');
  });

  it('keeps detailed ADRs indexed and complete enough for acquisition review', () => {
    const index = repositoryFile('docs/adr/README.md');

    for (const path of requiredFiles.filter((path) => /docs\/adr\/\d{4}-/.test(path))) {
      const filename = path.split('/').at(-1);
      expect(filename).toBeDefined();
      expect(index).toContain(filename!);
      const adr = repositoryFile(path);
      for (const heading of [
        '## Context',
        '## Alternatives considered',
        '## Decision',
        '## Consequences',
        '## Failure and recovery',
        '## Security and privacy impact',
        '## Compatibility and migration',
        '## Verification',
        '## Rollback or supersession',
      ]) {
        expect(adr).toContain(heading);
      }
    }
  });
});
