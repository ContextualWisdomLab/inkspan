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
  | 'empty-css'
  | 'hostile-origin'
  | 'invalid-css'
  | 'invalid-font'
  | 'midstream-failure'
  | 'oversized-css';

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
const css = \`@font-face {\n  font-family: 'Noto Sans';\n  font-style: normal;\n  font-weight: 400;\n  src: url(\${cssAsset}) format('woff2');\n  unicode-range: U+0000-00FF;\n}\`;
let trustedAssetRequests = 0;
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.startsWith('https://fonts.googleapis.com/css2?')) {
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
      const body = new ReadableStream({
        pull(controller) {
          writeFileSync(cssReadMarker, 'read', 'utf8');
          controller.enqueue(new TextEncoder().encode(css));
          controller.close();
        },
      });
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'text/css; charset=utf-8',
          'content-length': String(1024 * 1024 + 1),
        },
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

  it('rejects a 200 response that is not a WOFF2 artifact', () => {
    const { result } = runRegenerator('invalid-font');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
  });

  it('preserves the last known-good font set when regeneration fails midstream', () => {
    const { existingFontMarker, result } = runRegenerator('midstream-failure');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
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
});
