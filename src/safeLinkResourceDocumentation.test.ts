import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SAFE_LINK_MAX_HREF_BYTES,
  MAXIMUM_SAFE_LINK_MAX_HREF_BYTES,
} from './extensions/SafeLink.js';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const normalizeDocumentationWhitespace = (value: string): string =>
  value.replace(/\s+/gu, ' ');

describe('safe-link resource documentation contract', () => {
  it('labels the resource boundary as active-PR rather than protected-main behavior', () => {
    const guidance = repositoryFile('docs/link-security.md');

    expect(guidance).toContain('Status: `implemented_on_active_pr` in PR #182');
    expect(guidance).toContain('**not yet protected-main API**');
    expect(guidance).toContain(
      'Protected `main` continues to own the shipped hyperlink contract',
    );
  });

  it('keeps documented resource limits and ownership aligned with the public code contract', () => {
    const guidance = repositoryFile('docs/link-security.md');
    const normalizedGuidance = normalizeDocumentationWhitespace(guidance);

    expect(DEFAULT_SAFE_LINK_MAX_HREF_BYTES).toBe(65_536);
    expect(MAXIMUM_SAFE_LINK_MAX_HREF_BYTES).toBe(1_048_576);
    expect(normalizedGuidance).toContain('default target ceiling is 64 KiB');
    expect(normalizedGuidance).toContain('public hard maximum is 1 MiB');
    expect(normalizedGuidance).toContain(
      'before allocating a complete UTF-8 copy or invoking the WHATWG URL parser',
    );
    expect(normalizedGuidance).toContain(
      'not a transport request-size policy',
    );
    expect(normalizedGuidance).toContain('authorization decision');
  });

  it('documents stable payload-redacted error categories and the typed lowering option', () => {
    const guidance = repositoryFile('docs/link-security.md');

    expect(guidance).toContain('`SafeLinkValidationOptions.maxHrefBytes`');
    expect(guidance).toContain('`SafeLinkHrefError.code`');
    expect(guidance).toContain('`invalid_href`');
    expect(guidance).toContain('`input_too_large`');
    expect(guidance).toContain('`invalid_configuration`');
    expect(guidance).toContain('type SafeLinkValidationOptions');
  });
});
