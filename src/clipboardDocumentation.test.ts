import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository document as UTF-8 text. */
function repositoryDocument(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

/** Collapse Markdown layout whitespace without weakening semantic wording checks. */
function normalizedRepositoryDocument(path: string): string {
  return repositoryDocument(path).replace(/\s+/gu, ' ').trim();
}

describe('safe rich clipboard documentation contract', () => {
  it('binds host configuration validation to the paste boundary', () => {
    const operatorGuide = normalizedRepositoryDocument(
      'docs/clipboard-security.md',
    );

    expect(operatorGuide).toContain(
      'preserved by identity when the editor is created',
    );
    expect(operatorGuide).toContain(
      'validated only when rich HTML is pasted',
    );
    expect(operatorGuide).toContain(
      'without evaluating accessors or proxy traps during editor construction',
    );
  });

  it('documents final ordinary transform ordering and its hostile-host boundary', () => {
    const operatorGuide = normalizedRepositoryDocument(
      'docs/clipboard-security.md',
    );
    const doctoring = normalizedRepositoryDocument(
      'docs/doctoring/safe-rich-clipboard.md',
    );

    for (const document of [operatorGuide, doctoring]) {
      expect(document).toContain('lowest-practical TipTap extension priority');
      expect(document).toContain(
        'final ordinary `transformPastedHTML` transform',
      );
      expect(document).toContain('lower-priority transform');
    }
    expect(doctoring).toContain('TipTap extension priority');
    expect(doctoring).toContain('TipTap transformPastedHTML');
  });

  it('records Office hidden-style parsing and browser evidence limits', () => {
    const operatorGuide = normalizedRepositoryDocument(
      'docs/clipboard-security.md',
    );
    const doctoring = normalizedRepositoryDocument(
      'docs/doctoring/safe-rich-clipboard.md',
    );

    expect(operatorGuide).toContain('raw `style` declaration');
    expect(operatorGuide).toContain('CSS comments');
    expect(operatorGuide).toContain('CSS escape sequences');
    expect(doctoring).toContain('CSS Syntax Level 3');
    expect(doctoring).toContain(
      'No Chromium, Firefox, or WebKit conformance claim is made by this slice.',
    );
    expect(doctoring).toContain(
      '0.6.0 must not be published until the cross-engine corpus',
    );
    expect(doctoring).toContain('jsdom');
    expect(doctoring).toContain('DOMPurify');
    expect(doctoring).toContain('vulnerability-response obligation');
  });

  it('retains the current standards edition and explicit work-in-progress boundary', () => {
    const doctoring = normalizedRepositoryDocument(
      'docs/doctoring/safe-rich-clipboard.md',
    );

    expect(doctoring).toContain(
      'https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/',
    );
    expect(doctoring).toContain('24 June 2026');
    expect(doctoring).toContain('work in progress');
    expect(doctoring).not.toContain('WD-clipboard-apis-20251124');
  });

  it('keeps the design and implementation plan reconciled to reviewed behavior', () => {
    const design = normalizedRepositoryDocument(
      'docs/superpowers/specs/2026-08-05-safe-rich-clipboard-design.md',
    );
    const plan = normalizedRepositoryDocument(
      'docs/superpowers/plans/2026-08-05-safe-rich-clipboard.md',
    );

    for (const document of [design, plan]) {
      expect(document).toContain('original `ClipboardConfig` object');
      expect(document).toContain('lowest-practical TipTap extension priority');
      expect(document).toContain('cross-engine');
      expect(document).toContain('DOMPurify');
    }
    expect(plan).toContain('Post-review reconciliation');
    expect(design).toContain('No cross-engine browser conformance claim');
  });

  it('records the unreleased security and assurance changes', () => {
    const changelog = normalizedRepositoryDocument('CHANGELOG.md');

    expect(changelog).toContain('Raw `mso-hide` declarations');
    expect(changelog).toContain('CSS-escaped property and keyword forms');
    expect(changelog).toContain('final ordinary TipTap paste transform');
    expect(changelog).toContain('accessor-safe paste-time configuration');
    expect(changelog).toContain('cross-engine browser evidence');
  });
});
