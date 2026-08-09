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
    const escapeDoctoring = normalizedRepositoryDocument(
      'docs/doctoring/css-escaped-office-hidden-content.md',
    );

    expect(operatorGuide).toContain('raw `style` declaration');
    expect(operatorGuide).toContain('CSS comments');
    expect(operatorGuide).toContain('CSS escape sequences');
    expect(escapeDoctoring).toContain('CSS Syntax Level 3');
    expect(escapeDoctoring).toContain('null, surrogate');
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

  it('records content visibility hidden as a complete hidden-subtree boundary', () => {
    const operatorGuide = normalizedRepositoryDocument(
      'docs/clipboard-security.md',
    );
    const doctoring = normalizedRepositoryDocument(
      'docs/doctoring/content-visibility-hidden-content.md',
    );
    const changelog = normalizedRepositoryDocument('CHANGELOG.md');

    expect(operatorGuide).toContain(
      '`content-visibility: hidden` as a complete hidden-subtree boundary',
    );
    expect(operatorGuide).toContain(
      'bounded raw `style` declaration parser rather than CSSOM exposure',
    );
    expect(doctoring).toContain('CSS Containment Module Level 2');
    expect(doctoring).toContain(
      'skipped contents must not be available to user-agent features',
    );
    expect(doctoring).toContain('`visible`, `auto`, and `hiddenly`');
    expect(doctoring).toContain('Cross-engine Chromium, Firefox, and WebKit');
    expect(changelog).toContain(
      '`content-visibility: hidden` subtrees are removed',
    );
  });

  it('records visibility collapse as a hidden-content boundary', () => {
    const doctoring = normalizedRepositoryDocument(
      'docs/doctoring/visibility-collapse-hidden-content.md',
    );
    const changelog = normalizedRepositoryDocument('CHANGELOG.md');

    expect(doctoring).toContain('`visibility` value of either `hidden` or');
    expect(doctoring).toContain('`collapse` as a complete hidden-subtree marker');
    expect(doctoring).toContain('CSS Display Module Level 3');
    expect(doctoring).toContain('Cross-engine Chromium, Firefox, and WebKit');
    expect(changelog).toContain('hidden, and HTML-image subtrees are removed');
  });

  it('records closed interactive content as a hidden-content boundary', () => {
    const operatorGuide = normalizedRepositoryDocument(
      'docs/clipboard-security.md',
    );
    const doctoring = normalizedRepositoryDocument(
      'docs/doctoring/closed-interactive-content.md',
    );
    const changelog = normalizedRepositoryDocument('CHANGELOG.md');

    expect(operatorGuide).toContain(
      'a closed `<details>` element preserves only the sanitized contents of its first `<summary>` element child',
    );
    expect(operatorGuide).toContain(
      'a closed `<dialog>` subtree is dropped completely',
    );
    expect(doctoring).toContain('WHATWG HTML Living Standard');
    expect(doctoring).toContain(
      'A closed `details` contributes only its first `summary` element child',
    );
    expect(doctoring).toContain(
      'A closed `dialog` contributes no subtree',
    );
    expect(changelog).toContain(
      'Closed `details` elements preserve only their first rendered summary',
    );
  });

  it('records native-widget and obsolete fallback content as non-visible by default', () => {
    const operatorGuide = normalizedRepositoryDocument(
      'docs/clipboard-security.md',
    );
    const doctoring = normalizedRepositoryDocument(
      'docs/doctoring/native-widget-fallback-content.md',
    );
    const changelog = normalizedRepositoryDocument('CHANGELOG.md');

    for (const element of ['progress', 'meter', 'noframes', 'noembed']) {
      expect(operatorGuide).toContain(`\`${element}\``);
      expect(doctoring).toContain(`\`${element}\``);
    }
    expect(operatorGuide).toContain(
      'promote fallback text to ordinary visible editor prose',
    );
    expect(doctoring).toContain('HTML Living Standard: The progress element');
    expect(doctoring).toContain('HTML Living Standard: The meter element');
    expect(doctoring).toContain(
      'cross-engine differential corpus remains a release-acceptance gate',
    );
    expect(changelog).toContain(
      'Native `progress` and `meter` widget subtrees and obsolete `noframes` and `noembed` fallback subtrees are removed',
    );
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
