import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository text artifact for deterministic assertions. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

/**
 * Collapse prose whitespace and code-span punctuation without weakening words.
 *
 * Markdown authors may correctly wrap identifiers such as `docChanged` or
 * `aria-invalid` in code spans. The documentation contract checks the semantic
 * prose, not that presentational punctuation choice.
 */
function normalizeProse(value: string): string {
  return value.replace(/`/gu, '').replace(/\s+/gu, ' ').trim();
}

const designPath =
  'docs/superpowers/specs/2026-08-12-revision-bound-llm-writing-diagnostics-design.md';
const planPath =
  'docs/superpowers/plans/2026-08-12-writing-diagnostics-implementation.md';
const adrPath = 'docs/adr/0028-host-owned-llm-writing-diagnostics.md';
const supersedingAdrPath =
  'docs/adr/0029-writing-diagnostics-v1-strict-invalidation.md';

describe('writing diagnostics documentation contract', () => {
  it('keeps the public design examples synchronized with the implemented v1 types', () => {
    const design = repositoryFile(designPath);

    expect(design).toContain(
      "export type CwlWritingDiagnosticPriority =\n  | 'advisory'\n  | 'important'\n  | 'critical';",
    );
    expect(design).toContain(
      'readonly documentRevision: CwlEditorDocumentRevision;',
    );
    expect(design).toContain(
      'readonly textProjection: CwlEditorTextProjectionIdentity;',
    );
    expect(design).toContain('readonly judgePolicyVersion: string;');
    expect(design).toContain(
      'readonly reasonCode: CwlWritingDiagnosticActionReasonCode;',
    );
    expect(design).toContain('readonly generation: number;');
    expect(design).not.toContain(
      "export type CwlWritingDiagnosticPriority = 'suggestion' | 'important';",
    );
    expect(design).not.toContain('readonly documentRevision: string;');
    expect(design).not.toContain(
      "readonly projectionName: 'inkspan-prosemirror-text';",
    );
    expect(design).not.toContain("readonly status: 'completed'");
  });

  it('requires strict invalidation and semantic-neutral decoration guidance everywhere', () => {
    const design = normalizeProse(repositoryFile(designPath));
    const plan = repositoryFile(planPath);
    const adr = normalizeProse(repositoryFile(adrPath));
    const supersedingAdr = normalizeProse(repositoryFile(supersedingAdrPath));

    const strictInvalidation =
      'Every local or collaborative transaction with docChanged === true invalidates the complete active diagnostic generation.';
    const semanticNeutrality =
      'Inkspan does not derive aria-invalid or any other semantic accessibility state from opaque host strings.';

    expect(design).toContain(strictInvalidation);
    expect(adr).toContain(strictInvalidation);
    expect(supersedingAdr).toContain(
      'every transaction with docChanged === true, whether local or collaborative, invalidates the complete active diagnostic generation',
    );
    expect(design).toContain(semanticNeutrality);
    expect(adr).toContain(semanticNeutrality);

    expect(design).not.toContain('Inkspan may keep a diagnostic current');
    expect(design).not.toContain('local transaction mapping and invalidation');
    expect(design).not.toContain('Yjs remapping followed by revision rejection');
    expect(adr).not.toContain(
      'decoration mapping through local ProseMirror transactions',
    );
    expect(adr).not.toContain('A safely mapped local transaction may preserve');
    expect(adr).not.toContain('valid transaction-local mapping');
    expect(plan).not.toContain('aria-invalid="spelling"');
  });

  it('documents collapsed selectors and one-action-at-a-time application without batch authority', () => {
    const design = normalizeProse(repositoryFile(designPath));
    const adr = normalizeProse(repositoryFile(adrPath));

    expect(design).toContain(
      'selector values are non-negative safe integers with start <= end',
    );
    expect(design).toContain(
      'Version 1 applies exactly one explicitly selected diagnostic at a time.',
    );
    expect(adr).toContain(
      'Version 1 applies exactly one explicitly selected diagnostic at a time.',
    );
    expect(design).not.toContain('a bounded batch application');
    expect(design).not.toContain('batch_overlap');
    expect(adr).not.toContain('Apply all');
  });
});
