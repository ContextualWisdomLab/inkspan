import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('writing diagnostics stylesheet contract', () => {
  it('distinguishes diagnostic priorities without relying on color alone', () => {
    expect(styles).toMatch(
      /\.cwl-writing-diagnostic\s*\{[^}]*text-decoration-line:\s*underline\s*;[^}]*text-underline-offset:/u,
    );
    expect(styles).toMatch(
      /\.cwl-writing-diagnostic--advisory\s*\{[^}]*text-decoration-style:\s*dotted\s*;/u,
    );
    expect(styles).toMatch(
      /\.cwl-writing-diagnostic--important\s*\{[^}]*text-decoration-style:\s*dashed\s*;/u,
    );
    expect(styles).toMatch(
      /\.cwl-writing-diagnostic--critical\s*\{[^}]*text-decoration-style:\s*double\s*;/u,
    );
  });

  it('provides visible keyboard focus and touch-sized panel controls', () => {
    expect(styles).toMatch(
      /\.cwl-writing-diagnostics-panel__button\s*\{[^}]*min-height:\s*44px\s*;[^}]*min-width:\s*44px\s*;/u,
    );
    expect(styles).toMatch(
      /\.cwl-writing-diagnostics-panel__button:focus-visible[\s\S]*outline:/u,
    );
    expect(styles).toMatch(
      /\.cwl-writing-diagnostics-panel__item:focus-visible[\s\S]*outline:/u,
    );
  });

  it('has explicit forced-color and reduced-motion behavior', () => {
    expect(styles).toMatch(/@media\s*\(forced-colors:\s*active\)/u);
    expect(styles).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.cwl-writing-diagnostics-panel__button[\s\S]*transition:\s*none\s*;/u,
    );
  });

  it('prints document-only by default and an interaction-free appendix only when opted in', () => {
    const printIndex = styles.indexOf('@media print');
    expect(printIndex).toBeGreaterThan(-1);
    const printStyles = styles.slice(printIndex);
    expect(printStyles).toMatch(
      /\.cwl-writing-diagnostics-panel--screen-only[^{]*\{[^}]*display:\s*none\s*!important\s*;/u,
    );
    expect(printStyles).toMatch(
      /\.cwl-writing-diagnostics-panel--print\s*\{[^}]*display:\s*block\s*!important\s*;[^}]*break-before:\s*page\s*;/u,
    );
    expect(printStyles).toMatch(
      /\.cwl-writing-diagnostics-panel__navigation[\s\S]*\.cwl-writing-diagnostics-panel__actions[\s\S]*\{[^}]*display:\s*none\s*!important\s*;/u,
    );
  });
});
