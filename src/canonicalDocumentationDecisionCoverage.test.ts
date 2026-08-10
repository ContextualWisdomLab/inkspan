import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository document as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const migrationAdr =
  'docs/adr/0015-envelope-schema-migration-routing.md';
const browserAssuranceAdr =
  'docs/adr/0016-cross-engine-browser-assurance.md';
const securityDisclosureAdr =
  'docs/adr/0017-security-disclosure-lifecycle.md';
const textPositionAdr =
  'docs/adr/0018-revision-scoped-w3c-text-position-selector.md';

describe('canonical architecture decision coverage', () => {
  it('requires durable ADRs for protected authority decisions', () => {
    for (const path of [
      migrationAdr,
      browserAssuranceAdr,
      securityDisclosureAdr,
      textPositionAdr,
    ]) {
      expect(existsSync(resolve(process.cwd(), path)), path).toBe(true);
    }

    const index = repositoryFile('docs/adr/README.md');
    expect(index).toContain('0015-envelope-schema-migration-routing.md');
    expect(index).toContain('0016-cross-engine-browser-assurance.md');
    expect(index).toContain('0017-security-disclosure-lifecycle.md');
    expect(index).toContain('0018-revision-scoped-w3c-text-position-selector.md');
    expect(index).toContain('Envelope schema identity and host-owned migration routing');
    expect(index).toContain('Cross-engine browser-semantic release assurance');
    expect(index).toContain('Security disclosure lifecycle and coordinated vulnerability handling');
    expect(index).toContain('Revision-scoped W3C text-position selector authority');
  });

  it('keeps decision status synchronized with protected implementation maturity', () => {
    const migration = repositoryFile(migrationAdr);
    const browser = repositoryFile(browserAssuranceAdr);
    const security = repositoryFile(securityDisclosureAdr);
    const textPosition = repositoryFile(textPositionAdr);
    const index = repositoryFile('docs/adr/README.md');

    for (const adr of [migration, browser, security, textPosition]) {
      expect(adr).toContain('Status: Accepted');
    }
    expect(index).toMatch(/0015[^\n]*\| Accepted \|/u);
    expect(index).toMatch(/0016[^\n]*\| Accepted \|/u);
    expect(index).toMatch(/0017[^\n]*\| Accepted \|/u);
    expect(index).toMatch(/0018[^\n]*\| Accepted \|/u);

    for (const adr of [migration, browser, security, textPosition]) {
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
        '## References',
      ]) {
        expect(adr).toContain(heading);
      }
    }
  });

  it('distinguishes documentation completeness from implementation maturity', () => {
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');
    expect(fitness).toContain('Envelope schema identity / migration routing');
    expect(fitness).toContain('Cross-engine browser-semantic release assurance');
    expect(fitness).toContain('W3C text-position selector evidence');
    expect(fitness).toContain('SECURITY disclosure policy');
    expect(fitness).toContain('present_current');
    expect(fitness).toContain('implemented_on_protected_main');
    expect(fitness).toContain('implemented_on_active_pr');
    expect(fitness).toContain('planned');
    expect(fitness).toMatch(
      /Envelope schema identity \/ migration routing[^\n]*implemented_on_protected_main/u,
    );
    expect(fitness).toMatch(
      /Cross-engine browser-semantic release assurance[^\n]*implemented_on_protected_main/u,
    );
    expect(fitness).toMatch(
      /W3C text-position selector evidence[^\n]*implemented_on_protected_main/u,
    );
  });

  it('makes protected decision paths reviewable as diagrams and standards traceability', () => {
    const uml = repositoryFile('docs/UML.md');
    const traceability = repositoryFile('docs/TRACEABILITY.md');

    expect(uml).toContain('## Envelope identity and host-owned migration routing');
    expect(uml).toContain('## Cross-engine browser-semantic release assurance');
    expect(traceability).toContain('Envelope version routing');
    expect(traceability).toContain('Cross-engine release assurance');
    expect(traceability).toContain('W3C text-position selector');
    expect(traceability).toContain('RFC 7493');
    expect(traceability).toMatch(
      /Envelope version routing[^\n]*protected-main evidence/iu,
    );
    expect(traceability).toMatch(
      /Cross-engine release assurance[^\n]*protected-main/iu,
    );
    expect(traceability).toMatch(
      /W3C text-position selector[^\n]*protected-main/iu,
    );
    expect(traceability).not.toContain('PR #84 is active implementation evidence');
  });

  it('keeps the conceptual ERD explicit without inventing Inkspan persistence', () => {
    const dataModel = repositoryFile('docs/DATA_MODEL.md');

    for (const marker of [
      'document_schema_identity',
      'browser_assurance_evidence',
      'browser_difference_allowance',
      'text_position_selector_evidence',
    ]) {
      expect(dataModel).toContain(marker);
    }
    expect(dataModel).toContain('`document_schema_identity`: `implemented_on_protected_main`');
    expect(dataModel).toContain('`browser_assurance_evidence`: `implemented_on_protected_main`');
    expect(dataModel).toContain('`text_position_selector_evidence`: `implemented_on_protected_main`');
    expect(dataModel).toContain('release-assurance evidence objects');
    expect(dataModel).toContain('does **not** own an application database');
    expect(dataModel).toContain('physical database ERD');
  });

  it('keeps autonomous maintenance work-conserving without making it product runtime', () => {
    const agents = repositoryFile('AGENTS.md');
    const claude = repositoryFile('CLAUDE.md');
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');

    for (const guidance of [agents, claude]) {
      expect(guidance).toContain('work-conserving');
      expect(guidance).toContain('blocked PR blocks only that lane');
      expect(guidance).toContain('status report');
      expect(guidance).toContain('external scheduler');
    }

    expect(fitness).toContain('Autonomous maintenance governance');
    expect(fitness).toContain('out_of_scope');
    expect(fitness).toContain('external scheduler');
  });
});
