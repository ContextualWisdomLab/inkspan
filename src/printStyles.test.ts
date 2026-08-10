import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

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
});
