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

type FontRegenerationTestMode =
  | 'duplicate-face'
  | 'empty-css'
  | 'excessive-assets'
  | 'hostile-origin'
  | 'invalid-css'
  | 'invalid-font'
  | 'midstream-failure'
  | 'oversized-css'
  | 'redirected-asset'
  | 'redirected-css';

function createIsolatedFontRegenerator(): {
  root: string;
  scriptPath: string;
  preloadPath: string;
  contactMarker: string;
  cssReadMarker: string;
  existingFontMarker: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-font-refresh-'));
  temporaryRoots.push(root);
  const scriptPath = join(root, 'scripts', 'fetch-fonts.mjs');
  const preloadPath = join(root, 'mock-fetch.mjs');
  const contactMarker = join(root, 'hostile-origin-contacted');
  const cssReadMarker = join(root, 'oversized-css-body-read');
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
    `import { writeFileSync } from 'node:fs';
const mode = process.env.INKSPAN_FONT_TEST_MODE;
const contactMarker = process.env.INKSPAN_FONT_CONTACT_MARKER;
const cssReadMarker = process.env.INKSPAN_FONT_CSS_READ_MARKER;
const hostileAsset = 'https://attacker.example.invalid/subset.woff2';
const trustedAsset = 'https://fonts.gstatic.com/s/notosans/test-subset.woff2';
const cssAsset = mode === 'hostile-origin' ? hostileAsset : trustedAsset;
const css = \`@font-face {\n  font-family: 'Noto Sans';\n  font-style: normal;\n  font-weight: 400;\n  src: url(\${cssAsset}) format('woff2');\n  unicode-range: U+0000-00FF;\n}\n@font-face {\n  font-family: 'Noto Sans';\n  font-style: normal;\n  font-weight: 700;\n  src: url(\${cssAsset}) format('woff2');\n  unicode-range: U+0000-00FF;\n}\`;
const duplicateFaceCss = \`@font-face {\n  font-family: 'Noto Sans';\n  font-style: normal;\n  font-weight: 400;\n  src: url(\${trustedAsset}) format('woff2');\n  unicode-range: U+0000-00FF;\n}\n@font-face {\n  font-family: 'Noto Sans';\n  font-style: normal;\n  font-weight: 400;\n  src: url(\${trustedAsset}) format('woff2');\n  unicode-range: U+0000-00FF;\n}\n@font-face {\n  font-family: 'Noto Sans';\n  font-style: normal;\n  font-weight: 700;\n  src: url(\${trustedAsset}) format('woff2');\n  unicode-range: U+0100-017F;\n}\`;
const familyDefinitions = [
  ['Noto Sans KR', [400]],
  ['Noto Sans JP', [400]],
  ['Noto Sans SC', [400]],
  ['Noto Sans TC', [400]],
  ['Noto Sans', [400, 700]],
];
function excessiveCssFor(url) {
  const request = new URL(url).searchParams.get('family') ?? '';
  const definition = familyDefinitions.find(([family]) =>
    request.startsWith(\`${'${family}'}:wght@\`),
  );
  if (!definition) throw new Error('unexpected family request');
  const [family, weights] = definition;
  const faceCount = family === 'Noto Sans' ? 513 : 1;
  return Array.from({ length: faceCount }, (_, index) => {
    const weight = family === 'Noto Sans' && index === faceCount - 1
      ? 700
      : weights[0];
    return \`@font-face {\n  font-family: '\${family}';\n  font-style: normal;\n  font-weight: \${weight};\n  src: url(\${trustedAsset}) format('woff2');\n  unicode-range: U+0000-00FF;\n}\`;
  }).join('\\n');
}
let trustedAssetRequests = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith('https://fonts.googleapis.com/css2?')) {
    if (mode === 'redirected-css' && init?.redirect !== 'error') {
      writeFileSync(contactMarker, 'redirect-followed', 'utf8');
    }
    if (mode === 'invalid-css') {
      return new Response('<html>PRIVATE_PROXY_RESPONSE</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    if (mode === 'empty-css') {
      return new Response('/* no usable font faces */', {
        status: 200,
        headers: { 'content-type': 'text/css; charset=utf-8' },
      });
    }
    if (mode === 'oversized-css') {
      return {
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/css; charset=utf-8',
          'content-length': String(1024 * 1024 + 1),
        }),
        get body() {
          writeFileSync(cssReadMarker, 'read', 'utf8');
          throw new Error('oversized CSS body must not be read');
        },
        async text() {
          writeFileSync(cssReadMarker, 'read', 'utf8');
          return css;
        },
      };
    }
    if (mode === 'excessive-assets') {
      return new Response(excessiveCssFor(url), {
        status: 200,
        headers: { 'content-type': 'text/css; charset=utf-8' },
      });
    }
    if (mode === 'duplicate-face') {
      return new Response(duplicateFaceCss, {
        status: 200,
        headers: { 'content-type': 'text/css; charset=utf-8' },
      });
    }
    return new Response(css, {
      status: 200,
      headers: { 'content-type': 'text/css; charset=utf-8' },
    });
  }
  if (url === hostileAsset) {
    writeFileSync(contactMarker, 'contacted', 'utf8');
    return new Response(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]), {
      status: 200,
      headers: { 'content-type': 'font/woff2' },
    });
  }
  if (url === trustedAsset) {
    if (mode === 'redirected-asset' && init?.redirect !== 'error') {
      writeFileSync(contactMarker, 'redirect-followed', 'utf8');
    }
    if (mode === 'duplicate-face' || mode === 'excessive-assets') {
      writeFileSync(contactMarker, 'contacted', 'utf8');
    }
    trustedAssetRequests += 1;
    if (mode === 'midstream-failure' && trustedAssetRequests === 2) {
      return new Response('upstream unavailable', { status: 503 });
    }
    const body = mode === 'invalid-font'
      ? new TextEncoder().encode('<html>not a font</html>')
      : new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]);
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'font/woff2' },
    });
  }
  throw new Error('unexpected test URL');
};
`,
    'utf8',
  );
  return {
    root,
    scriptPath,
    preloadPath,
    contactMarker,
    cssReadMarker,
    existingFontMarker,
  };
}

function runRegenerator(mode: FontRegenerationTestMode) {
  const fixture = createIsolatedFontRegenerator();
  const result = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(fixture.preloadPath).href, fixture.scriptPath],
    {
      cwd: fixture.root,
      encoding: 'utf8',
      env: {
        ...process.env,
        INKSPAN_FONT_TEST_MODE: mode,
        INKSPAN_FONT_CONTACT_MARKER: fixture.contactMarker,
        INKSPAN_FONT_CSS_READ_MARKER: fixture.cssReadMarker,
      },
      timeout: 15_000,
    },
  );
  return { ...fixture, result };
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('font regeneration supply-chain boundary', () => {
  it('rejects an asset URL outside the trusted font CDN before contacting it', () => {
    const { contactMarker, result } = runRegenerator('hostile-origin');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(existsSync(contactMarker)).toBe(false);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(
      'attacker.example.invalid',
    );
  });

  it('disables automatic redirects for CSS discovery', () => {
    const { contactMarker, result } = runRegenerator('redirected-css');

    expect(result.error).toBeUndefined();
    expect(existsSync(contactMarker)).toBe(false);
  });

  it('disables automatic redirects for trusted font asset downloads', () => {
    const { contactMarker, result } = runRegenerator('redirected-asset');

    expect(result.error).toBeUndefined();
    expect(existsSync(contactMarker)).toBe(false);
  });

  it('rejects a 200 response that is not a WOFF2 artifact', () => {
    const { result } = runRegenerator('invalid-font');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
  });

  it('preserves the last known-good font set when regeneration fails midstream', () => {
    const { existingFontMarker, result } = runRegenerator('midstream-failure');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'font asset fetch failed with status 503',
    );
    expect(existsSync(existingFontMarker)).toBe(true);
    expect(readFileSync(existingFontMarker, 'utf8')).toBe('known-good');
  });

  it('rejects an invalid CSS response before replacing the known-good bundle', () => {
    const { existingFontMarker, result } = runRegenerator('invalid-css');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(existsSync(existingFontMarker)).toBe(true);
    expect(readFileSync(existingFontMarker, 'utf8')).toBe('known-good');
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(
      'PRIVATE_PROXY_RESPONSE',
    );
  });

  it('rejects CSS with no usable font faces before replacing the bundle', () => {
    const { existingFontMarker, result } = runRegenerator('empty-css');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(existsSync(existingFontMarker)).toBe(true);
    expect(readFileSync(existingFontMarker, 'utf8')).toBe('known-good');
  });

  it('rejects a declared oversized CSS response before reading its body', () => {
    const { cssReadMarker, existingFontMarker, result } =
      runRegenerator('oversized-css');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(existsSync(cssReadMarker)).toBe(false);
    expect(existsSync(existingFontMarker)).toBe(true);
    expect(readFileSync(existingFontMarker, 'utf8')).toBe('known-good');
  });

  it('rejects excessive font-face expansion before downloading any assets', () => {
    const { contactMarker, existingFontMarker, result } =
      runRegenerator('excessive-assets');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(existsSync(contactMarker)).toBe(false);
    expect(existsSync(existingFontMarker)).toBe(true);
    expect(readFileSync(existingFontMarker, 'utf8')).toBe('known-good');
  });

  it('rejects duplicate font-face metadata before downloading any assets', () => {
    const { contactMarker, existingFontMarker, result } =
      runRegenerator('duplicate-face');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(existsSync(contactMarker)).toBe(false);
    expect(existsSync(existingFontMarker)).toBe(true);
    expect(readFileSync(existingFontMarker, 'utf8')).toBe('known-good');
  });
});
