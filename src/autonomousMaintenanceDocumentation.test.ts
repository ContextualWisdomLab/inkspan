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
    expect(assessment).toContain('## Fitness matrix');
    expect(assessment).toContain('## Whole-conversation coverage decision');
    expect(assessment).toContain('## Sufficiency decision');
    expect(assessment).toContain('physical relational ERD');
    expect(assessment).toContain('`not_applicable`');
  });

  it('keeps release source readiness separate from registry operational acceptance', () => {
    const assessment = repositoryFile(assessmentPath);

    expect(assessment).toContain('protected manifests now agree at `0.6.0`');
    expect(assessment).toContain(
      'Registry operational acceptance remains open under issue #118',
    );
    expect(assessment).toContain(
      'Source integration does not prove that `v0.6.0` exists',
    );
  });

  it('records the current DOCX hyperlink line without promoting it to shipped behavior', () => {
    const assessment = repositoryFile(assessmentPath);

    expect(assessment).toMatch(
      /ADR graph[^\n]*owned by active PR #137/u,
    );
    expect(assessment).toContain(
      'PR #137 implements the current proposed bounded external-hyperlink contract',
    );
    expect(assessment).toContain('It is `implemented_on_active_pr`');
    expect(assessment).not.toMatch(
      /PR #137[^\n]*implemented_on_protected_main/u,
    );
  });
});
