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
    expect(accessibility).toContain('`Control+K Meta+K`');
    expect(accessibility).toContain('`Control+Z Meta+Z`');
    expect(accessibility).toContain(
      '`Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y`',
    );
    expect(accessibility).toContain(
      'describes shortcuts that Inkspan already implements; it does not create keyboard behavior',
    );
    expect(accessibility).toContain(
      'The link shortcut is implemented by Inkspan\'s editor surface',
    );
  });

  it('keeps buyer-facing README link guidance aligned with the shipped link command', () => {
    const readme = repositoryFile('README.md').replace(/\s+/g, ' ');

    expect(readme).toContain(
      'Inkspan applies one link policy to initial content, toolbar and Ctrl/Cmd+K commands, pasted/autolinked URLs',
    );
    expect(readme).not.toContain(
      'Tiptap Link extension implements Ctrl/Cmd+K',
    );
  });

  it('keeps public doctoring terminology consistent with the Tiptap references', () => {
    const doctoring = repositoryFile(
      'docs/doctoring/toolbar-shortcut-discoverability.md',
    );

    expect(doctoring).toContain(
      'Redo retains the same Tiptap command while exposing both existing key bindings.',
    );
    expect(doctoring).not.toContain(
      'Redo retains the same TipTap command while exposing both existing key bindings.',
    );
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
      'Inkspan implements `Control+K Meta+K` at the editor-surface level',
    );
    expect(doctoring).toContain('buyer-facing documentation');
    expect(doctoring).toContain('Tiptap. (n.d.). *Link extension*');
    expect(doctoring).toContain('Tiptap. (n.d.). *Undo/Redo extension*');
    expect(doctoring).toContain('Control+Y Meta+Y');
    expect(doctoring).toContain('8790b4e50bced266b38763c6301097aaeb775e4b');
    expect(doctoring).toContain('920fdb25c21022186acdf9782da6a16bb160a41d');
    expect(changelog).toContain('programmatic toolbar shortcut discoverability');
    expect(changelog).toContain('editor-surface `Ctrl/Cmd+K` link binding');
    expect(changelog).toContain('buyer-facing README guidance');
    expect(changelog).toContain('Control+Y Meta+Y');
  });
});
