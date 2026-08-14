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

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-font-budget-'));
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
const families = [
  ['Noto Sans', [400, 700]],
  ['Noto Sans KR', [400]],
  ['Noto Sans JP', [400]],
  ['Noto Sans SC', [400]],
  ['Noto Sans TC', [400]],
];
function requestedFamily(url) {
  const request = decodeURIComponent(new URL(url).searchParams.get('family') ?? '');
  return families.find(([family]) => request.startsWith(\`${'${family}'}:wght@\`));
}
function cssFor(url) {
  const definition = requestedFamily(url);
  if (!definition) throw new Error('unexpected family request');
  const [family, weights] = definition;
  const faces = family === 'Noto Sans'
    ? [400, 400, 400, 400, 700]
    : [weights[0]];
  return faces.map((weight, index) => \`@font-face {\n  font-family: '\${family}';\n  font-style: normal;\n  font-weight: \${weight};\n  src: url(\${trustedAsset}) format('woff2');\n  unicode-range: U+\${index.toString(16).padStart(4, '0')};\n}\`).join('\\n');
}
function validWoff2Fixture() {
  const bytes = new Uint8Array(48);
  bytes.set([0x77, 0x4f, 0x46, 0x32]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, bytes.byteLength, false);
  view.setUint16(12, 1, false);
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
    return new Response(validWoff2Fixture(), {
      status: 200,
      headers: {
        'content-type': 'font/woff2',
        'content-length': String(16 * 1024 * 1024),
      },
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

describe('font regeneration aggregate download budget', () => {
  it('fails closed when declared subset sizes exceed one family budget', () => {
    const fixture = createFixture();
    const result = spawnSync(
      process.execPath,
      ['--import', pathToFileURL(fixture.preloadPath).href, fixture.scriptPath],
      { cwd: fixture.root, encoding: 'utf8', timeout: 15_000 },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'aggregate font download budget',
    );
    expect(existsSync(fixture.existingFontMarker)).toBe(true);
    expect(readFileSync(fixture.existingFontMarker, 'utf8')).toBe('known-good');
  });
});
