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
  existsSync,
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
const MAX_FONT_FAMILY_DOWNLOAD_BYTES = 64 * 1024 * 1024;
const MAX_FONT_FACE_BLOCKS_PER_FAMILY = 512;
const MAX_UNICODE_CODE_POINT = 0x10ffff;
const WOFF2_HEADER_BYTES = 48;
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
const SRC_URL_RE = /url\((https:\/\/[^)]+\.woff2)\)/g;
const FAMILY_RE = /font-family:\s*(?:"([^"]+)"|'([^']+)')\s*;/g;
const STYLE_RE = /font-style:\s*([a-z-]+)\s*;/gi;
const STRETCH_RE = /font-stretch:\s*([^;]*);/gi;
const RANGE_RE = /unicode-range:\s*([^;]+);/g;
const WEIGHT_RE = /font-weight:\s*(\d+)\s*;/g;
const UNICODE_RANGE_HEX_RE = /^[0-9a-f]{1,6}$/i;
const UNICODE_RANGE_WILDCARD_RE = /^[0-9a-f]*\?+$/i;

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
  const res = await fetch(url, {
    redirect: 'error',
    headers: { 'User-Agent': UA },
  });
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

/** Validate the CSS Fonts unicode-range subset grammar without evaluating CSS. */
function isValidUnicodeRangeDescriptor(value) {
  const terms = value.split(',');
  return (
    terms.length > 0 &&
    terms.every((rawTerm) => {
      const term = rawTerm.trim();
      if (!/^u\+/i.test(term)) return false;
      const body = term.slice(2);
      const dashIndex = body.indexOf('-');

      if (dashIndex >= 0) {
        if (body.indexOf('-', dashIndex + 1) >= 0) return false;
        const start = body.slice(0, dashIndex);
        const end = body.slice(dashIndex + 1);
        if (!UNICODE_RANGE_HEX_RE.test(start) || !UNICODE_RANGE_HEX_RE.test(end)) {
          return false;
        }
        const startCodePoint = Number.parseInt(start, 16);
        const endCodePoint = Number.parseInt(end, 16);
        return (
          startCodePoint <= endCodePoint &&
          endCodePoint <= MAX_UNICODE_CODE_POINT
        );
      }

      if (UNICODE_RANGE_HEX_RE.test(body)) {
        return Number.parseInt(body, 16) <= MAX_UNICODE_CODE_POINT;
      }

      if (
        body.length < 1 ||
        body.length > 6 ||
        !UNICODE_RANGE_WILDCARD_RE.test(body)
      ) {
        return false;
      }
      const wildcardUpperBound = Number.parseInt(body.replaceAll('?', 'f'), 16);
      return (
        Number.isFinite(wildcardUpperBound) &&
        wildcardUpperBound <= MAX_UNICODE_CODE_POINT
      );
    })
  );
}

/**
 * Parse font-face blocks without materializing an unbounded attacker-controlled
 * expansion. CSS comments are removed first so descriptor-like text inside a
 * comment can never be mistaken for live font metadata.
 */
function collectBoundedFontFaceBlocks(css) {
  const commentFreeCss = css.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, '');
  const blocks = [];
  for (const match of commentFreeCss.matchAll(FONT_FACE_RE)) {
    if (blocks.length >= MAX_FONT_FACE_BLOCKS_PER_FAMILY) {
      throw new Error('Google Fonts returned excessive font-face metadata');
    }
    blocks.push(match[1]);
  }
  return blocks;
}

/** Read one response body without allowing per-subset or per-family overrun. */
async function readBoundedFontBody(response, remainingFamilyBytes) {
  const declaredLength = response.headers.get('content-length');
  const declaredBytes =
    declaredLength !== null && /^\d+$/.test(declaredLength)
      ? Number(declaredLength)
      : null;
  if (declaredBytes !== null && declaredBytes > MAX_FONT_SUBSET_BYTES) {
    throw new Error('Google Fonts returned an oversized font asset');
  }
  if (declaredBytes !== null && declaredBytes > remainingFamilyBytes) {
    throw new Error('Google Fonts exceeded the aggregate font download budget');
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
    if (totalBytes > remainingFamilyBytes) {
      await reader.cancel();
      throw new Error('Google Fonts exceeded the aggregate font download budget');
    }
    chunks.push(Buffer.from(value));
  }
  const bytes = Buffer.concat(chunks, totalBytes);
  return {
    bytes,
    budgetBytes: Math.max(declaredBytes ?? 0, totalBytes),
  };
}

/** Download and authenticate the minimal file-format boundary for one subset. */
async function download(source, remainingFamilyBytes) {
  const url = validateFontAssetUrl(source);
  const res = await fetch(url, {
    redirect: 'error',
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) {
    throw new Error(`Google Fonts font asset fetch failed with status ${res.status}`);
  }
  const { bytes, budgetBytes } = await readBoundedFontBody(
    res,
    remainingFamilyBytes,
  );
  const hasWoff2Signature =
    bytes.byteLength >= WOFF2_SIGNATURE.byteLength &&
    bytes.subarray(0, WOFF2_SIGNATURE.byteLength).equals(WOFF2_SIGNATURE);
  const hasConsistentDeclaredLength =
    bytes.byteLength >= WOFF2_HEADER_BYTES &&
    bytes.readUInt32BE(8) === bytes.byteLength;
  const hasDeclaredTables =
    bytes.byteLength >= WOFF2_HEADER_BYTES && bytes.readUInt16BE(12) > 0;
  if (!hasWoff2Signature || !hasConsistentDeclaredLength || !hasDeclaredTables) {
    throw new Error('Google Fonts returned a non-WOFF2 font asset');
  }
  return { bytes, budgetBytes };
}

async function processFamily(def, outputFilesDir) {
  const css = await fetchCss(def.css, def.weights);
  const blocks = collectBoundedFontFaceBlocks(css);
  const descriptors = [];
  const descriptorKeys = new Set();
  const requestedWeightCounts = {};

  for (const block of blocks) {
    const urlMatches = [...block.matchAll(SRC_URL_RE)];
    if (urlMatches.length === 0) continue;
    if (urlMatches.length !== 1) {
      throw new Error('Google Fonts returned ambiguous font source metadata');
    }

    const familyMatches = [...block.matchAll(FAMILY_RE)];
    if (familyMatches.length !== 1) {
      throw new Error('Google Fonts returned ambiguous font family metadata');
    }
    const family = familyMatches[0][1] ?? familyMatches[0][2];
    if (family !== def.family) {
      throw new Error('Google Fonts returned unexpected font family metadata');
    }

    const styleMatches = [...block.matchAll(STYLE_RE)];
    if (styleMatches.length !== 1) {
      throw new Error('Google Fonts returned ambiguous font style metadata');
    }
    const style = styleMatches[0][1].toLowerCase();
    if (style !== 'normal') {
      throw new Error('Google Fonts returned unexpected font style metadata');
    }

    const stretchMatches = [...block.matchAll(STRETCH_RE)];
    if (stretchMatches.length > 1) {
      throw new Error('Google Fonts returned ambiguous font stretch metadata');
    }
    const stretch =
      stretchMatches.length === 0
        ? 'normal'
        : stretchMatches[0][1].trim().toLowerCase();
    if (stretch !== 'normal') {
      throw new Error('Google Fonts returned unexpected font stretch metadata');
    }

    const weightMatches = [...block.matchAll(WEIGHT_RE)];
    if (weightMatches.length === 0) {
      throw new Error('Google Fonts returned unexpected font weight metadata');
    }
    if (weightMatches.length !== 1) {
      throw new Error('Google Fonts returned ambiguous font weight metadata');
    }
    const weight = weightMatches[0][1];
    if (!def.weights.includes(Number(weight))) {
      throw new Error('Google Fonts returned unexpected font weight metadata');
    }

    const rangeMatches = [...block.matchAll(RANGE_RE)];
    if (rangeMatches.length === 0) {
      throw new Error('Google Fonts returned invalid unicode-range metadata');
    }
    if (rangeMatches.length !== 1) {
      throw new Error('Google Fonts returned ambiguous unicode-range metadata');
    }
    const range = rangeMatches[0][1].trim();
    if (!range || !isValidUnicodeRangeDescriptor(range)) {
      throw new Error('Google Fonts returned invalid unicode-range metadata');
    }

    const source = validateFontAssetUrl(urlMatches[0][1]);
    const normalizedRange = range
      .split(',')
      .map((term) => term.trim().toLowerCase())
      .join(',');
    const descriptorKey = JSON.stringify([
      family,
      style,
      stretch,
      weight,
      normalizedRange,
    ]);
    if (descriptorKeys.has(descriptorKey)) {
      throw new Error('Google Fonts returned duplicate font-face metadata');
    }
    descriptorKeys.add(descriptorKey);
    requestedWeightCounts[weight] = (requestedWeightCounts[weight] ?? 0) + 1;
    descriptors.push({ source, weight, range });
  }

  if (descriptors.length === 0) {
    throw new Error('Google Fonts returned CSS without usable WOFF2 assets');
  }
  for (const requestedWeight of def.weights) {
    if (!requestedWeightCounts[String(requestedWeight)]) {
      throw new Error('Google Fonts returned incomplete requested font weight metadata');
    }
  }

  const out = [];
  let totalBytes = 0;
  let downloadBudgetBytes = 0;
  const counters = {};
  for (const descriptor of descriptors) {
    const { source, weight, range } = descriptor;
    counters[weight] = (counters[weight] ?? 0) + 1;
    const idx = counters[weight];
    const localName = `${def.slug}-${weight}-${idx}.woff2`;
    const { bytes, budgetBytes } = await download(
      source,
      MAX_FONT_FAMILY_DOWNLOAD_BYTES - downloadBudgetBytes,
    );
    downloadBudgetBytes += budgetBytes;
    totalBytes += bytes.byteLength;
    writeFileSync(resolve(outputFilesDir, localName), bytes);
    out.push(
      [
        '@font-face {',
        `  font-family: '${def.family}';`,
        '  font-style: normal;',
        `  font-weight: ${weight};`,
        '  font-display: swap;',
        `  src: url('./files/${localName}') format('woff2');`,
        `  unicode-range: ${range};`,
        '}',
      ].join('\n'),
    );
  }

  return { css: out.join('\n\n'), totalBytes, count: out.length };
}

/** Install validated generated outputs and restore the prior bundle on failure. */
function commitGeneratedOutputs(stagingRoot, outputs) {
  const backupRoot = resolve(stagingRoot, 'backup');
  mkdirSync(backupRoot, { recursive: true });

  const backedUp = [];
  const installed = [];
  try {
    for (const output of outputs) {
      if (!existsSync(output.target)) continue;
      renameSync(output.target, output.backup);
      backedUp.push(output);
    }

    for (const output of outputs) {
      renameSync(output.staged, output.target);
      installed.push(output);
    }
  } catch (commitError) {
    let rollbackFailed = false;

    for (const output of installed.reverse()) {
      try {
        rmSync(output.target, { recursive: true, force: true });
      } catch {
        rollbackFailed = true;
      }
    }

    for (const output of backedUp.reverse()) {
      try {
        if (existsSync(output.target)) {
          rmSync(output.target, { recursive: true, force: true });
        }
        renameSync(output.backup, output.target);
      } catch {
        rollbackFailed = true;
      }
    }

    if (rollbackFailed) {
      throw new Error(
        'Font bundle commit failed and the previous generated outputs could not be fully restored',
      );
    }
    throw commitError;
  }
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

    // Back up each previous output on the same filesystem before installing any
    // staged output. An ordinary synchronous installation failure can therefore
    // restore the complete prior generated bundle before the error escapes.
    const backupRoot = resolve(stagingRoot, 'backup');
    commitGeneratedOutputs(stagingRoot, [
      {
        staged: stagingFilesDir,
        target: FILES_DIR,
        backup: resolve(backupRoot, 'files'),
      },
      {
        staged: stagedFullCss,
        target: resolve(FONTS_DIR, 'fonts.css'),
        backup: resolve(backupRoot, 'fonts.css'),
      },
      {
        staged: stagedLatinCss,
        target: resolve(FONTS_DIR, 'fonts-latin.css'),
        backup: resolve(backupRoot, 'fonts-latin.css'),
      },
    ]);

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