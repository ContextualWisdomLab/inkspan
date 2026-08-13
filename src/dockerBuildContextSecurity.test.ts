import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const dockerIgnoreRules = readFileSync(resolve(process.cwd(), '.dockerignore'), 'utf8')
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'));

function escapeRegexCharacter(character: string): string {
  return /[\\^$.*+?()[\]{}|]/u.test(character) ? `\\${character}` : character;
}

function dockerPatternToRegex(pattern: string): RegExp {
  let source = '^';
  let offset = 0;
  while (offset < pattern.length) {
    if (pattern.startsWith('**/', offset)) {
      source += '(?:.*/)?';
      offset += 3;
      continue;
    }
    if (pattern.startsWith('**', offset)) {
      source += '.*';
      offset += 2;
      continue;
    }
    if (pattern[offset] === '*') {
      source += '[^/]*';
      offset += 1;
      continue;
    }
    source += escapeRegexCharacter(pattern[offset] ?? '');
    offset += 1;
  }
  return new RegExp(`${source}$`, 'u');
}

function isExcludedFromDockerContext(path: string): boolean {
  let excluded = false;
  for (const rule of dockerIgnoreRules) {
    const negated = rule.startsWith('!');
    const pattern = negated ? rule.slice(1) : rule;
    if (dockerPatternToRegex(pattern).test(path)) {
      excluded = !negated;
    }
  }
  return excluded;
}

describe('Docker build-context secret boundary', () => {
  it('excludes local environment and package-registry credentials recursively', () => {
    for (const privatePath of [
      '.env',
      '.env.production',
      'demo/.env.local',
      '.npmrc',
      'packages/editor/.pnpmrc',
      '.yarnrc.yml',
      'nested/.netrc',
    ]) {
      expect(isExcludedFromDockerContext(privatePath), privatePath).toBe(true);
    }
  });

  it('excludes common private-key and credential-container files recursively', () => {
    for (const privatePath of [
      'certificate.pem',
      'secrets/signing.key',
      'credentials/client.p12',
      'credentials/client.pfx',
    ]) {
      expect(isExcludedFromDockerContext(privatePath), privatePath).toBe(true);
    }
  });

  it('keeps explicit public examples and required build inputs in context', () => {
    for (const publicPath of [
      '.env.example',
      'demo/.env.example',
      'package.json',
      'pnpm-lock.yaml',
      'src/styles.css',
      'demo/App.tsx',
    ]) {
      expect(isExcludedFromDockerContext(publicPath), publicPath).toBe(false);
    }
  });
});
