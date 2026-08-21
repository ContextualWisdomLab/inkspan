import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('large-document performance baseline documentation', () => {
  it('keeps the proposed baseline distinct from a support claim', () => {
    const envelope = repositoryFile('docs/performance-envelope.md');
    const adr = repositoryFile(
      'docs/adr/0028-large-document-performance-baseline.md',
    );

    expect(envelope).toContain('Status: Proposed active-PR baseline');
    expect(envelope).toContain('inkspan-large-document-v1');
    expect(envelope).toContain('does not publish a maximum document size');
    expect(adr).toContain('- Status: Proposed');
    expect(adr).toContain('No benchmark code adds transport');
  });

  it('keeps the browser gate and smoke spec discoverable', () => {
    const config = repositoryFile('tests/browser/playwright.config.ts');
    const spec = repositoryFile(
      'tests/browser/specs/performance.browser.spec.ts',
    );
    const corpus = repositoryFile('tests/browser/performanceCorpus.ts');
    const harness = repositoryFile('tests/browser/harness.ts');

    expect(config).toContain('performance');
    expect(spec).toContain('PERFORMANCE_CORPUS_VERSION');
    expect(spec).toContain('without body telemetry');
    expect(corpus).toContain("'inkspan-large-document-v1'");
    expect(harness).toContain('runInkspanDocumentPerformanceProbe');
  });
});
