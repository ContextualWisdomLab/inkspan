import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const readme = readFileSync(resolve(repositoryRoot, 'README.md'), 'utf8');

function extractSection(markdown: string, heading: string, nextHeading: string): string {
  const sectionStart = markdown.indexOf(heading);
  const sectionEnd = markdown.indexOf(nextHeading, sectionStart + heading.length);

  expect(sectionStart).toBeGreaterThan(-1);
  expect(sectionEnd).toBeGreaterThan(sectionStart);

  return markdown.slice(sectionStart, sectionEnd);
}

describe('envelope identity buyer discovery', () => {
  it('documents the shipped framework-independent identity-routing surface', () => {
    const identitySection = extractSection(
      readme,
      '## Framework-independent envelope identity routing',
      '## Provider-neutral autosave',
    );

    expect(identitySection).toContain('@contextualwisdomlab/cwl-editor/envelope-identity');
    expect(identitySection).toContain('inspectDocumentEnvelopeIdentity');
    expect(identitySection).toContain('inspectDocumentEnvelopeIdentityBytes');
    expect(identitySection).toMatch(/routing metadata only/i);
    expect(identitySection).toMatch(/host[- ]owned migration/i);
  });
});
