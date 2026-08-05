import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository document as UTF-8 text. */
function repositoryDocument(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('safe rich clipboard documentation contract', () => {
  it('binds host configuration validation to the paste boundary', () => {
    const operatorGuide = repositoryDocument('docs/clipboard-security.md');

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
    const operatorGuide = repositoryDocument('docs/clipboard-security.md');
    const doctoring = repositoryDocument(
      'docs/doctoring/safe-rich-clipboard.md',
    );

    for (const document of [operatorGuide, doctoring]) {
      expect(document).toContain('lowest-practical TipTap extension priority');
      expect(document).toContain('final ordinary `transformPastedHTML` transform');
      expect(document).toContain('lower-priority transform');
    }
    expect(doctoring).toContain('TipTap extension priority');
    expect(doctoring).toContain('TipTap transformPastedHTML');
  });

  it('records Office hidden-style parsing and browser evidence limits', () => {
    const operatorGuide = repositoryDocument('docs/clipboard-security.md');
    const doctoring = repositoryDocument(
      'docs/doctoring/safe-rich-clipboard.md',
    );

    expect(operatorGuide).toContain('raw `style` declaration');
    expect(operatorGuide).toContain('CSS comments');
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
    const doctoring = repositoryDocument(
      'docs/doctoring/safe-rich-clipboard.md',
    );

    expect(doctoring).toContain(
      'https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/',
    );
    expect(doctoring).toContain('24 June 2026');
    expect(doctoring).toContain('work in progress');
    expect(doctoring).not.toContain('WD-clipboard-apis-20251124');
  });

  it('records the unreleased security and assurance changes', () => {
    const changelog = repositoryDocument('CHANGELOG.md');

    expect(changelog).toContain('raw `mso-hide` declarations');
    expect(changelog).toContain('final ordinary TipTap paste transform');
    expect(changelog).toContain('accessor-safe paste-time configuration');
    expect(changelog).toContain('cross-engine browser evidence');
  });
});
