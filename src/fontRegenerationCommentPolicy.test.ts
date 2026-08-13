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

function createIsolatedFontRegenerator(): {
  root: string;
  scriptPath: string;
  preloadPath: string;
  existingFontMarker: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-font-comment-policy-'));
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
    if (family === 'Noto Sans') {
      return \`@font-face {\n  /* font-family: '\${family}'; */\n  /* font-style: normal; */\n  /* font-weight: \${weight}; */\n  src: url(\${trustedAsset}) format('woff2');\n  /* unicode-range: U+0000-00FF; */\n}\`;
    }
    return \`@font-face {\n  font-family: '\${family}';\n  font-style: normal;\n  font-weight: \${weight};\n  src: url(\${trustedAsset}) format('woff2');\n  unicode-range: U+0000-00FF;\n}\`;
  }).join('\\n');
}
function woff2() {
  const bytes = new Uint8Array(48);
  bytes.set([0x77, 0x4f, 0x46, 0x32]);
  new DataView(bytes.buffer).setUint32(8, bytes.byteLength);
  return bytes;
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
    return new Response(woff2(), {
      status: 200,
      headers: { 'content-type': 'font/woff2' },
    });
  }
  throw new Error('unexpected test URL');
};
`,
    'utf8',
  );

  return { root, scriptPath, preloadPath, existingFontMarker };
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('font regeneration CSS comment policy', () => {
  it('rejects descriptors that exist only inside CSS comments', () => {
    const fixture = createIsolatedFontRegenerator();
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
  });
});
