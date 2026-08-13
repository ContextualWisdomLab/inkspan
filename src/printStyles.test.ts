import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const styles = repositoryFile('src/styles.css');

describe('print stylesheet contract', () => {
  it('defines an explicit paged-document print media boundary', () => {
    expect(styles).toMatch(/@media\s+print\s*\{/u);
  });

  it('removes screen-only clipping and interactive chrome from printed output', () => {
    const printIndex = styles.indexOf('@media print');
    expect(printIndex).toBeGreaterThan(-1);
    const printStyles = styles.slice(printIndex);

    expect(printStyles).toMatch(
      /\.cwl-toolbar[\s\S]*\.cwl-collaboration-status[\s\S]*\.collaboration-cursor__caret[\s\S]*\.collaboration-cursor__label[\s\S]*\{[^}]*display:\s*none\s*!important\s*;/u,
    );
    expect(printStyles).toMatch(
      /\.cwl-editor__surface\s*\{[^}]*overflow(?:-y)?:\s*visible\s*;[^}]*max-height:\s*none\s*;/u,
    );
    expect(printStyles).toMatch(
      /\.cwl-editor\s*\{[^}]*overflow:\s*visible\s*;[^}]*border:\s*0\s*;/u,
    );
  });

  it('does not print placeholder UI and keeps document blocks page-safe', () => {
    const printIndex = styles.indexOf('@media print');
    expect(printIndex).toBeGreaterThan(-1);
    const printStyles = styles.slice(printIndex);

    expect(printStyles).toMatch(
      /\.cwl-editor__content \.is-editor-empty:first-child::before\s*\{[^}]*content:\s*none\s*;/u,
    );
    expect(printStyles).toMatch(/break-inside:\s*avoid\s*;/u);
    expect(printStyles).toMatch(/break-after:\s*avoid\s*;/u);
    expect(printStyles).toMatch(/orphans:\s*3\s*;/u);
    expect(printStyles).toMatch(/widows:\s*3\s*;/u);
  });

  it('keeps authored links distinguishable independently of color', () => {
    expect(styles).toMatch(
      /\.cwl-editor__content a\s*\{[^}]*text-decoration:\s*underline\s*;/u,
    );
  });

  it('requires package and browser evidence to use the exported built stylesheet', () => {
    const packageVerifier = repositoryFile('tests/package/verify-package.mjs');
    const browserSpecification = repositoryFile(
      'tests/browser/specs/print.browser.spec.ts',
    );
    const browserConfiguration = repositoryFile(
      'tests/browser/playwright.config.ts',
    );

    expect(packageVerifier).toContain("'dist/cwl-editor.css'");
    expect(packageVerifier).toContain("'styles.css'");
    expect(browserSpecification).toContain('/dist/cwl-editor.css');
    expect(browserSpecification).not.toContain('/src/styles.css');
    expect(browserConfiguration).toContain('pnpm --dir ../.. build');
  });

  it('styles diagnostic ranges by priority without generated-text dependence', () => {
    expect(styles).toContain('.cwl-writing-diagnostic--advisory');
    expect(styles).toContain('.cwl-writing-diagnostic--important');
    expect(styles).toContain('.cwl-writing-diagnostic--critical');
    expect(styles).toContain('text-decoration-line: underline');
    expect(styles).toContain('.cwl-writing-diagnostics__item:focus-visible');
    expect(styles).toContain(
      '.cwl-writing-diagnostics__actions button:focus-visible',
    );
    expect(styles).not.toMatch(
      /\.cwl-writing-diagnostics[^\{]*::(?:before|after)\s*\{[^}]*content\s*:/u,
    );
  });

  it('keeps the empty-guidance focus handoff visibly perceivable', () => {
    expect(styles).toMatch(
      /\.cwl-writing-diagnostics:focus-visible[\s\S]*\{[^}]*outline:\s*2px solid var\(--cwl-accent\)\s*;[^}]*outline-offset:\s*2px\s*;/u,
    );
  });

  it('preserves forced-colors, reduced-motion, and touch-target guidance', () => {
    expect(styles).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*\.cwl-writing-diagnostic[\s\S]*CanvasText/u,
    );
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('min-width: 44px');
  });

  it('prints no guidance by default and only a compact opted-in appendix', () => {
    const printIndex = styles.indexOf('@media print');
    expect(printIndex).toBeGreaterThan(-1);
    const printStyles = styles.slice(printIndex);

    expect(printStyles).toMatch(
      /\.cwl-writing-diagnostics\s*\{[^}]*display:\s*none\s*!important\s*;/u,
    );
    expect(printStyles).toMatch(
      /\.cwl-writing-diagnostics\[data-print-enabled='true'\]\s*\{[^}]*display:\s*block\s*!important\s*;/u,
    );
    expect(printStyles).toMatch(
      /\.cwl-writing-diagnostics__actions[\s\S]*\.cwl-writing-diagnostics__navigation[\s\S]*\{[^}]*display:\s*none\s*!important\s*;/u,
    );
  });
});
