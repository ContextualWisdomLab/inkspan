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

type DescriptorMutation =
  | 'family'
  | 'style'
  | 'duplicate-family'
  | 'duplicate-style'
  | 'duplicate-weight'
  | 'duplicate-range'
  | 'duplicate-src';

function createIsolatedFontRegenerator(mutation: DescriptorMutation): {
  root: string;
  scriptPath: string;
  preloadPath: string;
  existingFontMarker: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-font-descriptor-policy-'));
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
const alternateTrustedAsset = 'https://fonts.gstatic.com/s/notosans/alternate-subset.woff2';
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
    const cssFamily = mutation === 'family' && family === 'Noto Sans'
      ? 'Noto Serif'
      : family;
    const cssStyle = mutation === 'style' && family === 'Noto Sans'
      ? 'italic'
      : 'normal';
    const familyDescriptors = mutation === 'duplicate-family' && family === 'Noto Sans'
      ? \`font-family: '\${family}';\\n  font-family: 'Noto Serif';\`
      : \`font-family: '\${cssFamily}';\`;
    const styleDescriptors = mutation === 'duplicate-style' && family === 'Noto Sans'
      ? 'font-style: normal;\\n  font-style: italic;'
      : \`font-style: \${cssStyle};\`;
    const weightDescriptors = mutation === 'duplicate-weight' && family === 'Noto Sans'
      ? \`font-weight: \${weight};\\n  font-weight: 999;\`
      : \`font-weight: \${weight};\`;
    const sourceDescriptors = mutation === 'duplicate-src' && family === 'Noto Sans'
      ? \`src: url(\${trustedAsset}) format('woff2');\\n  src: url(\${alternateTrustedAsset}) format('woff2');\`
      : \`src: url(\${trustedAsset}) format('woff2');\`;
    const rangeDescriptors = mutation === 'duplicate-range' && family === 'Noto Sans'
      ? 'unicode-range: U+0000-00FF;\\n  unicode-range: U+0100-017F;'
      : 'unicode-range: U+0000-00FF;';
    return \`@font-face {\n  \${familyDescriptors}\n  \${styleDescriptors}\n  \${weightDescriptors}\n  \${sourceDescriptors}\n  \${rangeDescriptors}\n}\`;
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
  if (url === trustedAsset || url === alternateTrustedAsset) {
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

function expectRejectedWithoutReplacingKnownGood(mutation: DescriptorMutation): void {
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

describe('font regeneration CSS descriptor policy', () => {
  it('rejects a CSS family descriptor that would be relabeled as the requested family', () => {
    expectRejectedWithoutReplacingKnownGood('family');
  });

  it('rejects non-normal CSS style metadata before relabeling the font as normal', () => {
    expectRejectedWithoutReplacingKnownGood('style');
  });

  it('rejects conflicting duplicate family descriptors instead of trusting the first one', () => {
    expectRejectedWithoutReplacingKnownGood('duplicate-family');
  });

  it('rejects conflicting duplicate style descriptors instead of trusting the first one', () => {
    expectRejectedWithoutReplacingKnownGood('duplicate-style');
  });

  it('rejects conflicting duplicate weight descriptors instead of trusting the first one', () => {
    expectRejectedWithoutReplacingKnownGood('duplicate-weight');
  });

  it('rejects conflicting duplicate unicode-range descriptors instead of trusting the first one', () => {
    expectRejectedWithoutReplacingKnownGood('duplicate-range');
  });

  it('rejects conflicting duplicate source descriptors instead of trusting the first one', () => {
    expectRejectedWithoutReplacingKnownGood('duplicate-src');
  });
});
