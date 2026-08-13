import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const dockerIgnoreRules = readFileSync(resolve(process.cwd(), '.dockerignore'), 'utf8')
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'));

function matchesPathSegment(pattern: string, value: string): boolean {
  let previous = Array.from({ length: value.length + 1 }, (_, index) => index === 0);

  for (const token of pattern) {
    const current = Array.from({ length: value.length + 1 }, () => false);
    if (token === '*') {
      current[0] = previous[0] ?? false;
      for (let index = 1; index <= value.length; index += 1) {
        current[index] =
          (previous[index] ?? false) || (current[index - 1] ?? false);
      }
    } else {
      for (let index = 1; index <= value.length; index += 1) {
        current[index] =
          (previous[index - 1] ?? false) &&
          (token === '?' || token === value[index - 1]);
      }
    }
    previous = current;
  }

  return previous[value.length] ?? false;
}

function matchesDockerPattern(pattern: string, path: string): boolean {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = path.split('/').filter(Boolean);

  if (patternSegments.length === 1) {
    const [singlePattern = ''] = patternSegments;
    return pathSegments.some((segment) =>
      matchesPathSegment(singlePattern, segment),
    );
  }

  const memo = new Map<string, boolean>();
  function visit(patternIndex: number, pathIndex: number): boolean {
    const key = `${patternIndex}:${pathIndex}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let matched: boolean;
    if (patternIndex === patternSegments.length) {
      matched = pathIndex === pathSegments.length;
    } else if (patternSegments[patternIndex] === '**') {
      matched =
        visit(patternIndex + 1, pathIndex) ||
        (pathIndex < pathSegments.length && visit(patternIndex, pathIndex + 1));
    } else {
      matched =
        pathIndex < pathSegments.length &&
        matchesPathSegment(
          patternSegments[patternIndex] ?? '',
          pathSegments[pathIndex] ?? '',
        ) &&
        visit(patternIndex + 1, pathIndex + 1);
    }

    memo.set(key, matched);
    return matched;
  }

  return visit(0, 0);
}

function isExcludedFromDockerContext(path: string): boolean {
  let excluded = false;
  for (const rule of dockerIgnoreRules) {
    const negated = rule.startsWith('!');
    const pattern = negated ? rule.slice(1) : rule;
    if (matchesDockerPattern(pattern, path)) {
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
