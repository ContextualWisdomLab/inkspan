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
  'SECURITY.md',
  'docs/README.md',
  'docs/DOCUMENTATION_FITNESS.md',
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
  'docs/adr/0011-deterministic-vs-model-assisted-authoring.md',
  'docs/adr/0012-spreadsheet-formula-injection.md',
  'docs/adr/0013-atomic-file-publication.md',
  'docs/adr/0014-local-assets-font-licensing.md',
  'docs/adr/0015-envelope-schema-migration-routing.md',
  'docs/adr/0016-cross-engine-browser-assurance.md',
  'docs/adr/0017-security-disclosure-lifecycle.md',
  'src/fonts/OFL.txt',
  'src/fonts/NOTICE',
  'src/fonts/fonts.css',
  'src/fonts/fonts-latin.css',
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
      '../SECURITY.md',
      'DOCUMENTATION_FITNESS.md',
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

  it('does not promote active-PR product requirements to protected-main implementation', () => {
    const prd = repositoryFile('docs/PRD.md');
    const productDefinition = prd.slice(
      prd.indexOf('## Product definition'),
      prd.indexOf('## Users and buyers'),
    );

    expect(productDefinition).toContain('Protected `main`');
    expect(productDefinition).toContain('Active PR / Proposed');
    expect(productDefinition).toContain('not shipped claims');
  });

  it('tracks protected and active implementation maturity semantically', () => {
    const prd = repositoryFile('docs/PRD.md');
    const trd = repositoryFile('docs/TRD.md');
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');
    const currentScope = prd.slice(prd.indexOf('## Current, proposed, and planned scope'));

    expect(currentScope).toMatch(/lifecycle observation[^.]*implemented on protected `main`/iu);
    expect(currentScope).toMatch(/SafeClipboard[^.]*implemented on protected `main`/u);
    expect(currentScope).toMatch(/Envelope identity-only migration routing[^.]*implemented_on_active_pr/u);
    expect(currentScope).not.toMatch(/open development lines include[^.]*lifecycle observation/u);
    expect(trd).toContain('Autosave lifecycle observation is implemented on protected `main`');
    expect(trd).toContain('SafeClipboard is implemented on protected `main`');
    expect(trd).toMatch(/Envelope identity routing is `implemented_on_active_pr`/u);
    expect(fitness).toContain('Autosave lifecycle observation');
    expect(fitness).toMatch(/Autosave lifecycle observation[^\n]*implemented_on_protected_main/u);
    expect(fitness).toMatch(/Envelope schema identity \/ migration routing[^\n]*implemented_on_protected_main/u);
  });

  it('records host ownership and deterministic Inkspan authority consistently', () => {
    const prd = repositoryFile('docs/PRD.md');
    const trd = repositoryFile('docs/TRD.md');
    const contracts = repositoryFile('docs/CONTRACTS.md');
    const threatModel = repositoryFile('docs/THREAT_MODEL.md');
    const operability = repositoryFile('docs/OPERABILITY.md');

    for (const document of [prd, trd, contracts, threatModel, operability]) {
      expect(document).toMatch(/host[^.]*transport/i);
      expect(document).toMatch(/host[^.]*authentication/i);
      expect(document).toMatch(/host[^.]*authorization/i);
      expect(document).toMatch(/host[^.]*tenant(?: isolation|cy)/i);
      expect(document).toMatch(/host[^.]*durable persistence|host[^.]*persistence/i);
    }
    expect(prd).toContain('deterministic');
    expect(trd).toContain('Protected `main`');
    expect(threatModel).toContain('document bodies');
    expect(operability).toContain('rollback');
  });

  it('preserves durable product decisions from the canonical documentation graph', () => {
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
    expect(uml).toContain('CI-only; not runtime');
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
    const security = repositoryFile('SECURITY.md');
    const threatModel = repositoryFile('docs/THREAT_MODEL.md');
    const testStrategy = repositoryFile('docs/TEST_STRATEGY.md');
    const traceability = repositoryFile('docs/TRACEABILITY.md');
    const contracts = repositoryFile('docs/CONTRACTS.md');

    expect(security).toContain('Report a vulnerability');
    expect(security).toContain('private GitHub Security Advisory');
    expect(security).toContain('does not promise a response-time SLA');
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

  it('keeps documentation completeness and implementation maturity explicit', () => {
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');

    for (const documentFamily of [
      'PRD',
      'TRD',
      'ARCHITECTURE',
      'ADR',
      'UML',
      'DATA_MODEL / ERD',
      'SECURITY',
      'THREAT_MODEL',
      'TEST_STRATEGY',
      'OPERABILITY',
      'TRACEABILITY',
    ]) {
      expect(fitness).toContain(documentFamily);
    }

    for (const status of [
      'present_current',
      'implemented_on_protected_main',
      'implemented_on_active_pr',
      'planned',
      'not_applicable',
    ]) {
      expect(fitness).toContain(status);
    }

    expect(fitness).toContain('SECURITY disclosure policy');
    expect(fitness).toContain('physical relational ERD');
    expect(fitness).toContain('not_applicable');
    expect(fitness).toContain('Protected `main`');
    expect(fitness).toContain('documentation graph is a protected-main canonical baseline');
    expect(fitness).not.toContain('not yet a protected-main canonical baseline');
  });

  it('keeps offline font provenance and network-free asset contracts explicit', () => {
    const license = repositoryFile('src/fonts/OFL.txt');
    const notice = repositoryFile('src/fonts/NOTICE');
    const fullFonts = repositoryFile('src/fonts/fonts.css');
    const latinFonts = repositoryFile('src/fonts/fonts-latin.css');

    expect(license).toContain('SIL Open Font License, Version 1.1');
    expect(license).toContain('Reserved Font Name "Noto"');
    for (const marker of [
      'Noto Sans',
      'Noto Sans KR',
      'Noto Sans JP',
      'Noto Sans SC',
      'Noto Sans TC',
      'air-gapped',
      'OFL-1.1',
    ]) {
      expect(notice).toContain(marker);
    }
    for (const stylesheet of [fullFonts, latinFonts]) {
      const fontUrls = [
        ...stylesheet.matchAll(
          /url\(\s*(?:'([^']*)'|"([^"]*)"|([^'")\s]+))\s*\)/gu,
        ),
      ].map(([, singleQuoted, doubleQuoted, unquoted]) =>
        singleQuoted ?? doubleQuoted ?? unquoted,
      );
      expect(fontUrls.length).toBeGreaterThan(0);
      for (const url of fontUrls) {
        expect(url).toMatch(/^\.\/files\//u);
      }
    }
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
