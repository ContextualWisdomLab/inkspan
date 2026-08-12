import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryRoots: string[] = [];

function createIsolatedFontRegenerator({
  weight = 999,
  unicodeRange = 'U+0000-00FF',
}: {
  weight?: number;
  unicodeRange?: string;
} = {}): {
  root: string;
  scriptPath: string;
  preloadPath: string;
  existingFontMarker: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-font-metadata-policy-'));
  temporaryRoots.push(root);
  const scriptPath = join(root, 'scripts', 'fetch-fonts.mjs');
  const preloadPath = join(root, 'mock-fetch.mjs');
  const existingFontMarker = join(
    root,
    'src',
    'fonts',
    'files',
    'known-good.woff2',
  );

  mkdirSync(dirname(scriptPath), { recursive: true });
  mkdirSync(dirname(existingFontMarker), { recursive: true });
  writeFileSync(existingFontMarker, 'known-good', 'utf8');
  writeFileSync(
    scriptPath,
    readFileSync(resolve('scripts/fetch-fonts.mjs'), 'utf8'),
    'utf8',
  );
  writeFileSync(
    preloadPath,
    `const trustedAsset = 'https://fonts.gstatic.com/s/notosans/test-subset.woff2';
const css = \`@font-face {\n  font-family: 'Noto Sans';\n  font-style: normal;\n  font-weight: ${weight};\n  src: url(\${trustedAsset}) format('woff2');\n  unicode-range: ${unicodeRange};\n}\`;
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.startsWith('https://fonts.googleapis.com/css2?')) {
    return new Response(css, {
      status: 200,
      headers: { 'content-type': 'text/css; charset=utf-8' },
    });
  }
  if (url === trustedAsset) {
    return new Response(
      new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]),
      {
        status: 200,
        headers: { 'content-type': 'font/woff2' },
      },
    );
  }
  throw new Error('unexpected test URL');
};
`,
    'utf8',
  );

  return { root, scriptPath, preloadPath, existingFontMarker };
}

function runFixture(fixture: ReturnType<typeof createIsolatedFontRegenerator>) {
  return spawnSync(
    process.execPath,
    ['--import', pathToFileURL(fixture.preloadPath).href, fixture.scriptPath],
    {
      cwd: fixture.root,
      encoding: 'utf8',
      env: process.env,
      timeout: 15_000,
    },
  );
}

function expectRejectedWithoutReplacingKnownGood(
  fixture: ReturnType<typeof createIsolatedFontRegenerator>,
): void {
  const result = runFixture(fixture);
  expect(result.error).toBeUndefined();
  expect(result.status).not.toBe(0);
  expect(existsSync(fixture.existingFontMarker)).toBe(true);
  expect(readFileSync(fixture.existingFontMarker, 'utf8')).toBe('known-good');
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('font regeneration metadata policy', () => {
  it('rejects CSS weight metadata outside the exact requested family weights', () => {
    expectRejectedWithoutReplacingKnownGood(createIsolatedFontRegenerator());
  });

  it('rejects CSS that omits one of the exact requested family weights', () => {
    expectRejectedWithoutReplacingKnownGood(
      createIsolatedFontRegenerator({ weight: 400 }),
    );
  });

  it('rejects invalid CSS unicode-range metadata before publishing the bundle', () => {
    expectRejectedWithoutReplacingKnownGood(
      createIsolatedFontRegenerator({
        weight: 400,
        unicodeRange: 'not-a-unicode-range',
      }),
    );
  });
});
