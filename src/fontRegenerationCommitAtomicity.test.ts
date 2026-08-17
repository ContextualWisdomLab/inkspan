import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryRoots: string[] = [];
const OLD_FULL_CSS = '/* known-good full css */\n';
const OLD_LATIN_CSS = '/* known-good latin css */\n';
const INJECTED_COMMIT_FAILURE = 'injected font commit rename failure';

function runRegeneratorWithCommitFailure(target: 'files' | 'fonts.css' | 'fonts-latin.css') {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-font-commit-'));
  temporaryRoots.push(root);

  const scriptPath = join(root, 'scripts', 'fetch-fonts.mjs');
  const preloadPath = join(root, 'mock-font-commit-failure.mjs');
  const fontsDir = join(root, 'src', 'fonts');
  const existingFontMarker = join(fontsDir, 'files', 'known-good.woff2');
  const fullCssPath = join(fontsDir, 'fonts.css');
  const latinCssPath = join(fontsDir, 'fonts-latin.css');

  mkdirSync(dirname(scriptPath), { recursive: true });
  mkdirSync(dirname(existingFontMarker), { recursive: true });
  writeFileSync(existingFontMarker, 'known-good', 'utf8');
  writeFileSync(fullCssPath, OLD_FULL_CSS, 'utf8');
  writeFileSync(latinCssPath, OLD_LATIN_CSS, 'utf8');
  writeFileSync(
    scriptPath,
    readFileSync(resolve('scripts/fetch-fonts.mjs'), 'utf8'),
    'utf8',
  );

  writeFileSync(
    preloadPath,
    `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const failTarget = process.env.INKSPAN_FONT_FAIL_COMMIT_TARGET;
const originalRenameSync = fs.renameSync;
let injected = false;
fs.renameSync = (source, destination) => {
  const sourceText = String(source).replaceAll('\\\\', '/');
  const destinationText = String(destination).replaceAll('\\\\', '/');
  if (
    !injected &&
    sourceText.includes('/.font-refresh-') &&
    !sourceText.includes('/backup/') &&
    destinationText.endsWith('/src/fonts/' + failTarget)
  ) {
    injected = true;
    throw new Error('${INJECTED_COMMIT_FAILURE}');
  }
  return originalRenameSync(source, destination);
};
syncBuiltinESMExports();

const trustedAsset = 'https://fonts.gstatic.com/s/notosans/test-subset.woff2';
const familyDefinitions = [
  ['Noto Sans KR', [400]],
  ['Noto Sans JP', [400]],
  ['Noto Sans SC', [400]],
  ['Noto Sans TC', [400]],
  ['Noto Sans', [400, 700]],
];
function cssFor(url) {
  const request = new URL(url).searchParams.get('family') ?? '';
  const definition = familyDefinitions.find(([family]) =>
    request.startsWith(\`${'${family}'}:wght@\`),
  );
  if (!definition) throw new Error('unexpected family request');
  const [family, weights] = definition;
  return weights.map((weight) => \`@font-face {\n  font-family: '\${family}';\n  font-style: normal;\n  font-weight: \${weight};\n  src: url(\${trustedAsset}) format('woff2');\n  unicode-range: U+0000-00FF;\n}\`).join('\\n');
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
      headers: { 'content-type': 'font/woff2' },
    });
  }
  throw new Error('unexpected test URL');
};
`,
    'utf8',
  );

  const result = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(preloadPath).href, scriptPath],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        INKSPAN_FONT_FAIL_COMMIT_TARGET: target,
      },
      timeout: 15_000,
    },
  );

  return { result, existingFontMarker, fullCssPath, latinCssPath };
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('font regeneration commit atomicity', () => {
  for (const target of ['files', 'fonts.css', 'fonts-latin.css'] as const) {
    it(`restores every known-good generated output when ${target} installation fails`, () => {
      const { result, existingFontMarker, fullCssPath, latinCssPath } =
        runRegeneratorWithCommitFailure(target);

      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain(INJECTED_COMMIT_FAILURE);
      expect(readFileSync(existingFontMarker, 'utf8')).toBe('known-good');
      expect(readFileSync(fullCssPath, 'utf8')).toBe(OLD_FULL_CSS);
      expect(readFileSync(latinCssPath, 'utf8')).toBe(OLD_LATIN_CSS);
    });
  }
});
