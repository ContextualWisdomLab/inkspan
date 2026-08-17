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
  const root = mkdtempSync(join(tmpdir(), 'inkspan-font-fragmentation-'));
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
let cssRequestCount = 0;
let fontRequestCount = 0;
function requestedFamily(url) {
  const request = decodeURIComponent(new URL(url).searchParams.get('family') ?? '');
  return families.find(([family]) => request.startsWith(\`${'${family}'}:wght@\`));
}
function cssFor(url) {
  const definition = requestedFamily(url);
  if (!definition) throw new Error('unexpected family request');
  const [family, weights] = definition;
  return weights.map((weight, index) => \`@font-face {\n  font-family: '\${family}';\n  font-style: normal;\n  font-weight: \${weight};\n  src: url(\${trustedAsset}) format('woff2');\n  unicode-range: U+\${index.toString(16).padStart(4, '0')};\n}\`).join('\\n');
}
function validWoff2Fixture(size = 48) {
  const bytes = new Uint8Array(size);
  bytes.set([0x77, 0x4f, 0x46, 0x32]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, bytes.byteLength, false);
  view.setUint16(12, 1, false);
  return bytes;
}
function fragmentedResponse(bytes, headers) {
  let offset = 0;
  let emitEmptyChunk = true;
  const body = new ReadableStream({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      if (emitEmptyChunk) {
        controller.enqueue(new Uint8Array(0));
        emitEmptyChunk = false;
        return;
      }
      controller.enqueue(bytes.subarray(offset, offset + 1));
      offset += 1;
      emitEmptyChunk = true;
    },
  });
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    body,
  };
}
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.startsWith('https://fonts.googleapis.com/css2?')) {
    cssRequestCount += 1;
    const css = cssFor(url);
    if (process.env.INKSPAN_FRAGMENT_MODE === 'css' && cssRequestCount === 1) {
      // Non-empty chunks alone stay below the 4,096-chunk local ceiling. The
      // alternating zero-length chunks are therefore necessary to cross it.
      const bytes = new TextEncoder().encode(css + ' '.repeat(2049));
      return fragmentedResponse(bytes, {
        'content-type': 'text/css; charset=utf-8',
        'content-length': String(bytes.byteLength),
      });
    }
    return new Response(css, {
      status: 200,
      headers: { 'content-type': 'text/css; charset=utf-8' },
    });
  }
  if (url === trustedAsset) {
    fontRequestCount += 1;
    if (process.env.INKSPAN_FRAGMENT_MODE === 'font' && fontRequestCount === 1) {
      // 2,049 one-byte chunks are under the ceiling; alternating empty chunks
      // make this a >4,096-chunk stream without approaching the byte ceiling.
      const bytes = validWoff2Fixture(2049);
      return fragmentedResponse(bytes, {
        'content-type': 'font/woff2',
        'content-length': String(bytes.byteLength),
      });
    }
    return new Response(validWoff2Fixture(), {
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

function runFixture(mode: 'css' | 'font') {
  const fixture = createFixture();
  const result = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(fixture.preloadPath).href, fixture.scriptPath],
    {
      cwd: fixture.root,
      encoding: 'utf8',
      timeout: 15_000,
      env: { ...process.env, INKSPAN_FRAGMENT_MODE: mode },
    },
  );
  return { fixture, result };
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('font regeneration stream fragmentation bounds', () => {
  it('rejects a CSS response fragmented beyond the local chunk budget', () => {
    const { fixture, result } = runFixture('css');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'excessively fragmented CSS response',
    );
    expect(existsSync(fixture.existingFontMarker)).toBe(true);
    expect(readFileSync(fixture.existingFontMarker, 'utf8')).toBe('known-good');
  });

  it('rejects a WOFF2 response fragmented beyond the local chunk budget', () => {
    const { fixture, result } = runFixture('font');

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'excessively fragmented font asset response',
    );
    expect(existsSync(fixture.existingFontMarker)).toBe(true);
    expect(readFileSync(fixture.existingFontMarker, 'utf8')).toBe('known-good');
  });
});
