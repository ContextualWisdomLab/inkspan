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

type StretchMutation = 'non-normal' | 'percentage' | 'duplicate';

function createIsolatedFontRegenerator(mutation: StretchMutation): {
  root: string;
  scriptPath: string;
  preloadPath: string;
  existingFontMarker: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-font-stretch-policy-'));
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
    `const mutation = ${JSON.stringify(mutation)};
const trustedAsset = 'https://fonts.gstatic.com/s/notosans/test-subset.woff2';
const familyDefinitions = [
  ['Noto Sans KR', [400]],
  ['Noto Sans JP', [400]],
  ['Noto Sans SC', [400]],
  ['Noto Sans TC', [400]],
  ['Noto Sans', [400, 700]],
];
function requestedFamily(url) {
  const request = new URL(url).searchParams.get('family') ?? '';
  return familyDefinitions.find(([family]) => request.startsWith(\`${'${family}'}:wght@\`));
}
function cssFor(url) {
  const definition = requestedFamily(url);
  if (!definition) throw new Error('unexpected family request');
  const [family, weights] = definition;
  return weights.map((weight) => {
    const stretch = family === 'Noto Sans'
      ? mutation === 'duplicate'
        ? 'font-stretch: normal;\\n  font-stretch: condensed;'
        : mutation === 'percentage'
          ? 'font-stretch: 75%;'
          : 'font-stretch: condensed;'
      : 'font-stretch: normal;';
    return \`@font-face {\n  font-family: '\${family}';\n  font-style: normal;\n  \${stretch}\n  font-weight: \${weight};\n  src: url(\${trustedAsset}) format('woff2');\n  unicode-range: U+0000-00FF;\n}\`;
  }).join('\\n');
}
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.startsWith('https://fonts.googleapis.com/css2?')) {
    return new Response(cssFor(url), {
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

function expectRejectedWithoutReplacingKnownGood(mutation: StretchMutation): void {
  const fixture = createIsolatedFontRegenerator(mutation);
  const result = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(fixture.preloadPath).href, fixture.scriptPath],
    {
      cwd: fixture.root,
      encoding: 'utf8',
      env: process.env,
      timeout: 15_000,
    },
  );

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

describe('font regeneration stretch descriptor policy', () => {
  it('rejects non-normal stretch metadata before relabeling the font at normal width', () => {
    expectRejectedWithoutReplacingKnownGood('non-normal');
  });

  it('rejects percentage stretch metadata before relabeling the font at normal width', () => {
    expectRejectedWithoutReplacingKnownGood('percentage');
  });

  it('rejects ambiguous duplicate stretch metadata before publication', () => {
    expectRejectedWithoutReplacingKnownGood('duplicate');
  });
});
