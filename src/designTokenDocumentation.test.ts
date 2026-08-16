import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const normalize = (value: string): string => value.replace(/\s+/gu, ' ').trim();

describe('editor design-token documentation contract', () => {
  it('tells hosts how to re-theme repeating chrome without editing internals', () => {
    const operatorGuide = normalize(repositoryFile('docs/design-tokens.md'));
    const inventory = normalize(repositoryFile('docs/storybook-inventory.md'));
    const doctoring = repositoryFile('docs/doctoring/editor-design-tokens.md');
    const changelog = normalize(repositoryFile('CHANGELOG.md'));
    const index = repositoryFile('docs/README.md');
    const adrIndex = repositoryFile('docs/adr/README.md');

    expect(index).toContain('[`design-tokens.md`](design-tokens.md)');
    expect(adrIndex).toContain('[0031](0031-editor-design-tokens-storybook.md) | Proposed');
    expect(operatorGuide).toContain('Override the named custom properties on `.cwl-editor`');
    expect(operatorGuide).toContain('Do not edit Inkspan internals');
    expect(inventory).toContain('Editor Chrome / Toolbar Button States');
    expect(inventory).toContain('Override `--cwl-accent`');
    expect(doctoring).toContain('Design Tokens Format Module 2025.10');
    expect(doctoring).toContain(
      'https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/',
    );
    expect(doctoring).toContain('https://www.w3.org/TR/WCAG22/');
    expect(doctoring).toContain('https://storybook.js.org/docs/get-started/frameworks/react-vite');
    expect(changelog).toContain('Named the repeating editor chrome as a host-facing theme-token catalog');
    expect(repositoryFile('.storybook/main.ts')).toContain("@storybook/react-vite");
    expect(repositoryFile('stories/EditorChrome.stories.tsx')).toContain('cwl-tb-btn');
  });
});
