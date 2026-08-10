import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const assessmentPath =
  'docs/assessments/2026-08-10-conversation-documentation-reassessment.md';

describe('autonomous maintenance and acquisition documentation', () => {
  it('treats user-reported premature stopping as a control-plane incident', () => {
    const agents = repositoryFile('AGENTS.md');
    const claude = repositoryFile('CLAUDE.md');

    for (const guidance of [agents, claude]) {
      expect(guidance).toContain('scheduler-control incident');
      expect(guidance).toContain('zero completion credit');
      expect(guidance).toContain('two materially distinct executable repository actions');
      expect(guidance).toContain('reset the two-sweep count');
      expect(guidance).toContain('simplify the external prompt');
    }
  });

  it('keeps the dated whole-conversation reassessment discoverable', () => {
    const index = repositoryFile('docs/README.md');
    const assessment = repositoryFile(assessmentPath);

    expect(index).toContain(
      'assessments/2026-08-10-conversation-documentation-reassessment.md',
    );
    expect(assessment).toContain(
      'main@f2a87bc32710574b54c0ccd1a4f33fee2c6f2224',
    );
    expect(assessment).toContain('## Fitness matrix');
    expect(assessment).toContain('## Whole-conversation coverage decision');
    expect(assessment).toContain('## Sufficiency decision');
    expect(assessment).toContain('physical relational ERD');
    expect(assessment).toContain('`not_applicable`');
  });

  it('keeps release source readiness separate from registry operational acceptance', () => {
    const assessment = repositoryFile(assessmentPath);

    expect(assessment).toContain('protected manifests agree at `0.6.0`');
    expect(assessment).toContain(
      'Registry operational acceptance remains open under issue #118',
    );
    expect(assessment).toContain(
      'Source integration does not prove that `v0.6.0` exists',
    );
    expect(assessment).toContain(
      'Release-note reconciliation for the post-#135 protected-source change remains an issue #118 prerequisite',
    );
  });

  it('reconciles the protected DOCX hyperlink decision', () => {
    const adr = repositoryFile(
      'docs/adr/0026-bounded-docx-external-hyperlinks.md',
    );
    const adrIndex = repositoryFile('docs/adr/README.md');
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');
    const traceability = repositoryFile('docs/TRACEABILITY.md');

    expect(adr).toContain('Status: Accepted');
    expect(adr).toContain('implemented on protected `main` through PR #137');
    expect(adr).not.toContain('Protected `main` does **not** yet expose');
    expect(adr).not.toContain('active PR #137 implements');
    expect(adrIndex).toMatch(
      /\[0026\][^\n]*\| Accepted \| Bounded external hyperlinks/u,
    );
    expect(fitness).toMatch(
      /DOCX bounded external hyperlinks[^\n]*present_current[^\n]*implemented_on_protected_main/u,
    );
    expect(traceability).toMatch(
      /DOCX bounded external hyperlinks[^\n]*protected-main #137/u,
    );
  });
});
