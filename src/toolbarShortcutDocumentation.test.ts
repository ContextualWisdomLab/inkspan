import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('toolbar shortcut accessibility documentation', () => {
  it('documents programmatic shortcut discoverability and its behavior boundary', () => {
    const accessibility = repositoryFile('docs/accessibility.md');

    expect(accessibility).toContain('`aria-keyshortcuts`');
    expect(accessibility).toContain('`Control+B Meta+B`');
    expect(accessibility).toContain('`Control+I Meta+I`');
    expect(accessibility).not.toContain('`Control+K Meta+K`');
    expect(accessibility).toContain('`Control+Z Meta+Z`');
    expect(accessibility).toContain('`Control+Shift+Z Meta+Shift+Z`');
    expect(accessibility).toContain(
      'describes shortcuts that Inkspan already implements; it does not create keyboard behavior',
    );
    expect(accessibility).toContain(
      'The link control intentionally does not advertise a keyboard shortcut',
    );
  });

  it('keeps buyer-facing README link guidance within the implemented shortcut boundary', () => {
    const readme = repositoryFile('README.md').replace(/\s+/g, ' ');

    expect(readme).toContain(
      'Inkspan applies one link policy to initial content, toolbar commands, pasted/autolinked URLs',
    );
    expect(readme).not.toContain('toolbar and Ctrl/Cmd+K commands');
  });

  it('records current standards evidence and release traceability', () => {
    const accessibility = repositoryFile('docs/accessibility.md');
    const doctoring = repositoryFile(
      'docs/doctoring/toolbar-shortcut-discoverability.md',
    );
    const changelog = repositoryFile('CHANGELOG.md');

    expect(accessibility).toContain('WAI-ARIA 1.2 `aria-keyshortcuts`');
    expect(doctoring).toContain(
      '# Doctoring record: toolbar shortcut discoverability',
    );
    expect(doctoring).toContain('## APA 7 references');
    expect(doctoring).toContain('Accessible Rich Internet Applications (WAI-ARIA) 1.2');
    expect(doctoring).toContain('Toolbar pattern');
    expect(doctoring).toContain(
      'The configured Tiptap Link extension does not bind a keyboard shortcut',
    );
    expect(doctoring).toContain('buyer-facing README');
    expect(doctoring).toContain('Tiptap. (n.d.). *Link extension*');
    expect(doctoring).toContain('57f5ef8e21f8351fa04c122e700b43777c9ea57e');
    expect(doctoring).toContain('e89f51e87e84552247c7080aa61800c7da813e40');
    expect(changelog).toContain('programmatic toolbar shortcut discoverability');
    expect(changelog).toContain('unimplemented link shortcut claim');
    expect(changelog).toContain('buyer-facing README guidance');
  });
});
