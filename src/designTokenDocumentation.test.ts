import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryPath = (path: string): string => resolve(process.cwd(), path);

const repositoryFile = (path: string): string =>
  readFileSync(repositoryPath(path), 'utf8');

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
    expect(repositoryFile('docs/TRD.md')).toContain('theme-token catalog');
    expect(repositoryFile('docs/UML.md')).toContain('Active PR / Proposed');
    expect(repositoryFile('docs/UML.md')).toContain('--cwl-*');
    expect(existsSync(repositoryPath('docs/adr/0027-editor-design-tokens-storybook.md'))).toBe(
      false,
    );
    expect(repositoryFile('docs/TRACEABILITY.md')).toContain('ADR 0031');
    expect(repositoryFile('docs/TRACEABILITY.md')).not.toContain('ADR 0027');
    expect(doctoring).toContain('ADR 0031');
    expect(doctoring).not.toContain('ADR 0027');
    expect(operatorGuide).toContain('When a host overrides any color token');
    expect(operatorGuide).toContain('shipped dark active-toolbar pair now uses');
    expect(operatorGuide).toContain('getEditorThemeTokenContrast');
    expect(operatorGuide).toContain("getEditorThemeTokenContrast('cwl-accent', 'cwl-accent-soft', 'dark')");
    expect(operatorGuide).toContain('meetsTextContrast');
    expect(operatorGuide).toContain('contrastRatioFromHex');
    expect(operatorGuide).toContain('Do not edit Inkspan internals');
    expect(inventory).toContain('Editor Chrome / Toolbar Button States');
    expect(inventory).toContain('Editor Chrome / Live Toolbar');
    expect(inventory).toContain('shipped Toolbar');
    expect(inventory).toContain(':focus-visible');
    expect(inventory).toContain('Shipped defaults require no host override');
    expect(inventory).toContain('If re-theming, override `--cwl-accent`');
    expect(doctoring).toContain('cwl-accent-soft');
    expect(doctoring).toContain('meets the WCAG 2.2 4.5:1');
    expect(doctoring).toContain('Inkspan now ships dark `--cwl-accent: #58a6ff`');
    expect(doctoring).toContain('producing about 5.06:1');
    expect(doctoring).toContain('Host overrides must still re-check their own resulting pairs');
    expect(doctoring).toContain('Design Tokens Format Module 2025.10');
    expect(doctoring).toContain(
      'https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/',
    );
    expect(doctoring).toContain('https://www.w3.org/TR/WCAG22/');
    expect(doctoring).toContain('https://storybook.js.org/docs/get-started/frameworks/react-vite');
    expect(changelog).toContain('Named the repeating editor chrome as a host-facing theme-token catalog');
    expect(changelog).toContain('Raised the shipped dark active-toolbar accent');
    expect(repositoryFile('.storybook/main.ts')).toContain("@storybook/react-vite");
    expect(repositoryFile('stories/EditorChrome.stories.tsx')).toContain('cwl-tb-btn');
    expect(repositoryFile('stories/EditorChrome.stories.tsx')).toContain('autoFocus');
    expect(repositoryFile('stories/EditorChrome.stories.tsx')).toContain('disabled');
    expect(repositoryFile('stories/EditorChrome.stories.tsx')).toContain('cwl-editor__surface');
    expect(repositoryFile('stories/EditorChrome.stories.tsx')).toContain(
      'cwl-collaboration-status',
    );
    expect(repositoryFile('stories/EditorChrome.stories.tsx')).toContain(
      "from '../src/components/Toolbar.js'",
    );
    expect(inventory).toContain('class-level chrome sample');
  });
});