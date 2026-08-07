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
    expect(accessibility).toContain('`Control+Shift+Z Meta+Shift+Z`');
    expect(accessibility).toContain(
      'describes shortcuts that Inkspan already implements; it does not create keyboard behavior',
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
    expect(doctoring).toContain('303149b4d3e586ba32c1306d1a7d98542142d9d3');
    expect(doctoring).toContain('29d8c156e40eb0975687ee83053bedf3de7d77a5');
    expect(changelog).toContain('programmatic toolbar shortcut discoverability');
  });
});
