/**
 * fetch-fonts.mjs — build-time generator for the BUNDLED, self-contained
 * Noto Sans web fonts (SIL OFL 1.1) that ship inside the package for
 * air-gapped / 폐쇄망 (offline) use.
 *
 * It asks the Google Fonts css2 API for each family (with a modern-browser
 * User-Agent so we get woff2 + unicode-range subsets), then DOWNLOADS every
 * subset woff2 into src/fonts/files/ and rewrites the @font-face `src` to a
 * relative local path. The result references NO network resource — the CDN is
 * used only at generation time, never at render time.
 *
 * This is a maintenance/regeneration tool, not part of `pnpm build`. Re-run it
 * only to refresh the bundled fonts:  `node scripts/fetch-fonts.mjs`.
 *
 * Fonts are Noto Sans (OFL 1.1). See src/fonts/OFL.txt and src/fonts/NOTICE.
 */
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS_DIR = resolve(ROOT, 'src/fonts');
const FILES_DIR = resolve(FONTS_DIR, 'files');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TRUSTED_FONT_ASSET_HOST = 'fonts.gstatic.com';
const MAX_FONT_CSS_BYTES = 1024 * 1024;
const MAX_FONT_SUBSET_BYTES = 16 * 1024 * 1024;
const WOFF2_SIGNATURE = Buffer.from([0x77, 0x4f, 0x46, 0x32]);

// Latin/Vietnamese carries the primary UI text and is cheap, so ship 400+700.
// The CJK families are large; ship weight 400 only and let the browser
// synthesize bold for headings to keep the bundle reasonable.
const FAMILIES = [
  { css: 'Noto Sans', slug: 'noto-sans', family: 'Noto Sans', weights: [400, 700] },
  { css: 'Noto Sans KR', slug: 'noto-sans-kr', family: 'Noto Sans KR', weights: [400] },
  { css: 'Noto Sans JP', slug: 'noto-sans-jp', family: 'Noto Sans JP', weights: [400] },
  { css: 'Noto Sans SC', slug: 'noto-sans-sc', family: 'Noto Sans SC', weights: [400] },
  { css: 'Noto Sans TC', slug: 'noto-sans-tc', family: 'Noto Sans TC', weights: [400] },
];

const FONT_FACE_RE = /@font-face\s*{([^}]*)}/g;
const SRC_URL_RE = /url\((https:\/\/[^)]+\.woff2)\)/;
const RANGE_RE = /unicode-range:\s*([^;]+);/;
const WEIGHT_RE = /font-weight:\s*(\d+)/;

/** Read CSS discovery data through a bounded stream before decoding it. */
async function readBoundedCssBody(response) {
  const declaredLength = response.headers.get('content-length');
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > MAX_FONT_CSS_BYTES
  ) {
    throw new Error('Google Fonts returned an oversized CSS response');
  }

  if (response.body === null) {
    throw new Error('Google Fonts returned an empty CSS response');
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_FONT_CSS_BYTES) {
      await reader.cancel();
      throw new Error('Google Fonts returned an oversized CSS response');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, totalBytes);
}

async function fetchCss(family, weights) {
  const w = weights.join(';');
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  )}:wght@${w}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`css2 fetch failed for ${family}: ${res.status}`);

  const mediaType = res.headers
    .get('content-type')
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== 'text/css') {
    throw new Error('Google Fonts returned an invalid CSS response type');
  }

  const bytes = await readBoundedCssBody(res);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Google Fonts returned invalid UTF-8 CSS');
  }
}

/** Validate one CSS-provided asset URL before any asset request occurs. */
function validateFontAssetUrl(source) {
  let url;
  try {
    url = new URL(source);
  } catch {
    throw new Error('Google Fonts returned an invalid font asset URL');
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== TRUSTED_FONT_ASSET_HOST ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    !url.pathname.endsWith('.woff2') ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('Google Fonts returned an untrusted font asset URL');
  }
  return url.href;
}

/** Read one response body without allowing an unbounded subset allocation. */
async function readBoundedFontBody(response) {
  const declaredLength = response.headers.get('content-length');
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > MAX_FONT_SUBSET_BYTES
  ) {
    throw new Error('Google Fonts returned an oversized font asset');
  }

  if (response.body === null) {
    throw new Error('Google Fonts returned an empty font asset response');
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_FONT_SUBSET_BYTES) {
      await reader.cancel();
      throw new Error('Google Fonts returned an oversized font asset');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, totalBytes);
}

/** Download and authenticate the minimal file-format boundary for one subset. */
async function download(source) {
  const url = validateFontAssetUrl(source);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    throw new Error(`Google Fonts font asset fetch failed with status ${res.status}`);
  }
  const bytes = await readBoundedFontBody(res);
  if (
    bytes.byteLength < WOFF2_SIGNATURE.byteLength ||
    !bytes.subarray(0, WOFF2_SIGNATURE.byteLength).equals(WOFF2_SIGNATURE)
  ) {
    throw new Error('Google Fonts returned a non-WOFF2 font asset');
  }
  return bytes;
}

async function processFamily(def, outputFilesDir) {
  const css = await fetchCss(def.css, def.weights);
  const blocks = [...css.matchAll(FONT_FACE_RE)].map((m) => m[1]);
  const out = [];
  let totalBytes = 0;
  const counters = {};
  for (const block of blocks) {
    const urlMatch = SRC_URL_RE.exec(block);
    const rangeMatch = RANGE_RE.exec(block);
    const weightMatch = WEIGHT_RE.exec(block);
    if (!urlMatch) continue;
    const weight = weightMatch ? weightMatch[1] : '400';
    counters[weight] = (counters[weight] ?? 0) + 1;
    const idx = counters[weight];
    const localName = `${def.slug}-${weight}-${idx}.woff2`;
    const bytes = await download(urlMatch[1]);
    totalBytes += bytes.byteLength;
    writeFileSync(resolve(outputFilesDir, localName), bytes);
    const range = rangeMatch ? rangeMatch[1].trim() : '';
    out.push(
      [
        '@font-face {',
        `  font-family: '${def.family}';`,
        '  font-style: normal;',
        `  font-weight: ${weight};`,
        '  font-display: swap;',
        `  src: url('./files/${localName}') format('woff2');`,
        range ? `  unicode-range: ${range};` : null,
        '}',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  if (out.length === 0) {
    throw new Error('Google Fonts returned CSS without usable WOFF2 assets');
  }
  return { css: out.join('\n\n'), totalBytes, count: out.length };
}

const HEADER = (title) =>
  `/* ${title}\n` +
  ` * Bundled Noto Sans web fonts — SIL Open Font License 1.1.\n` +
  ` * Self-contained: every src url() points to a woff2 shipped inside this\n` +
  ` * package (./files/), so rendering needs NO network (air-gapped / 폐쇄망).\n` +
  ` * GENERATED by scripts/fetch-fonts.mjs — do not edit by hand.\n` +
  ` * License: src/fonts/OFL.txt  Attribution: src/fonts/NOTICE\n` +
  ` */\n`;

async function main() {
  // Remote CSS/assets are generated completely in a sibling staging directory.
  // A fetch or validation failure therefore cannot delete the last known-good
  // bundled font set. Only after every remote input is accepted do we replace
  // the generated outputs in the working tree.
  const stagingRoot = mkdtempSync(resolve(FONTS_DIR, '.font-refresh-'));
  const stagingFilesDir = resolve(stagingRoot, 'files');
  mkdirSync(stagingFilesDir, { recursive: true });

  try {
    const perFamily = {};
    let grandTotal = 0;
    for (const def of FAMILIES) {
      process.stdout.write(`Fetching ${def.css} (weights ${def.weights.join(', ')})… `);
      const r = await processFamily(def, stagingFilesDir);
      perFamily[def.slug] = r;
      grandTotal += r.totalBytes;
      console.log(`${r.count} subsets, ${(r.totalBytes / 1024 / 1024).toFixed(2)} MB`);
    }

    // Full stack: all five scripts (Korean, Latin/Vietnamese, Japanese, SC, TC).
    const fullOrder = ['noto-sans', 'noto-sans-kr', 'noto-sans-jp', 'noto-sans-sc', 'noto-sans-tc'];
    const fullCss =
      HEADER('cwl-editor fonts — full multilingual stack (KR / EN+VI / JP / SC / TC)') +
      '\n' +
      fullOrder.map((s) => perFamily[s].css).join('\n\n') +
      '\n';

    // Latin-only opt-out (English + Vietnamese + Latin-ext), tiny.
    const latinCss =
      HEADER('cwl-editor fonts — Latin/Vietnamese only (opt-out of CJK)') +
      '\n' +
      perFamily['noto-sans'].css +
      '\n';

    const stagedFullCss = resolve(stagingRoot, 'fonts.css');
    const stagedLatinCss = resolve(stagingRoot, 'fonts-latin.css');
    writeFileSync(stagedFullCss, fullCss);
    writeFileSync(stagedLatinCss, latinCss);

    // This is the commit boundary. No network-derived mutation of the existing
    // bundle occurs before all CSS and WOFF2 inputs have passed validation.
    rmSync(FILES_DIR, { recursive: true, force: true });
    renameSync(stagingFilesDir, FILES_DIR);
    rmSync(resolve(FONTS_DIR, 'fonts.css'), { force: true });
    renameSync(stagedFullCss, resolve(FONTS_DIR, 'fonts.css'));
    rmSync(resolve(FONTS_DIR, 'fonts-latin.css'), { force: true });
    renameSync(stagedLatinCss, resolve(FONTS_DIR, 'fonts-latin.css'));

    console.log(
      `\nTotal bundled: ${(grandTotal / 1024 / 1024).toFixed(2)} MB across ` +
        `${Object.values(perFamily).reduce((n, r) => n + r.count, 0)} woff2 files.`,
    );
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
