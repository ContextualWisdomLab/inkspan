import {
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

type Woff2HeaderMutation = 'inconsistent-length' | 'zero-tables';

function createIsolatedFontRegenerator(mutation: Woff2HeaderMutation): {
  root: string;
  scriptPath: string;
  preloadPath: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-woff2-header-'));
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
const trustedAsset = 'https://fonts.gstatic.com/s/notosans/header-test.woff2';

function cssForRequest(url) {
  const request = new URL(url).searchParams.get('family');
  if (!request) throw new Error('missing family request');
  const separator = ':wght@';
  const separatorIndex = request.indexOf(separator);
  if (separatorIndex < 0) throw new Error('missing weight request');
  const family = request.slice(0, separatorIndex);
  const weights = request.slice(separatorIndex + separator.length).split(';');
  return weights.map((weight) => \`@font-face {\n  font-family: '\${family}';\n  font-style: normal;\n  font-weight: \${weight};\n  src: url(\${trustedAsset}) format('woff2');\n  unicode-range: U+0000-00FF;\n}\`).join('\\n');
}

function malformedWoff2Header() {
  const bytes = new Uint8Array(48);
  bytes.set([0x77, 0x4f, 0x46, 0x32], 0);
  new DataView(bytes.buffer).setUint32(
    8,
    mutation === 'inconsistent-length' ? 49 : bytes.byteLength,
    false,
  );
  return bytes;
}

globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.startsWith('https://fonts.googleapis.com/css2?')) {
    return new Response(cssForRequest(url), {
      status: 200,
      headers: { 'content-type': 'text/css; charset=utf-8' },
    });
  }
  if (url === trustedAsset) {
    return new Response(malformedWoff2Header(), {
      status: 200,
      headers: { 'content-type': 'font/woff2' },
    });
  }
  throw new Error('unexpected test URL');
};
`,
    'utf8',
  );

  return { root, scriptPath, preloadPath };
}

function expectHeaderRejected(mutation: Woff2HeaderMutation): void {
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
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('font regeneration WOFF2 header policy', () => {
  it('rejects an artifact whose WOFF2 length field disagrees with its body', () => {
    expectHeaderRejected('inconsistent-length');
  });

  it('rejects a WOFF2 artifact whose header declares zero font tables', () => {
    expectHeaderRejected('zero-tables');
  });
});
