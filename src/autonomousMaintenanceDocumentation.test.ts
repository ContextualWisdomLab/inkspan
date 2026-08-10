import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

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

  it('keeps release source readiness separate from registry operational acceptance', () => {
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');
    const traceability = repositoryFile('docs/TRACEABILITY.md');

    expect(fitness).toContain('protected manifests now agree at `0.6.0`');
    expect(fitness).toContain('registry operational acceptance remains open under issue #118');
    expect(fitness).not.toContain('next stable registry release still requires one coherent npm/Office/tag version');
    expect(traceability).toContain('Unified 0.6.0 source candidate');
    expect(traceability).toContain('public npm/PyPI digest verification remains operational evidence');
  });

  it('records the current DOCX hyperlink line without promoting it to shipped behavior', () => {
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');
    const traceability = repositoryFile('docs/TRACEABILITY.md');

    expect(fitness).toMatch(
      /DOCX bounded external hyperlinks[^\n]*owned_by_separate_active_pr[^\n]*implemented_on_active_pr/u,
    );
    expect(fitness).toContain('PR #137');
    expect(traceability).toMatch(
      /DOCX bounded external hyperlinks[^\n]*Active PR #137[^\n]*Proposed/u,
    );
    expect(traceability).not.toMatch(
      /DOCX bounded external hyperlinks[^\n]*implemented on protected `main`/iu,
    );
  });
});
