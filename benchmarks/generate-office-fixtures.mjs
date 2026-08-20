import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DOCX_PROFILE_PAGES = Object.freeze({
  small: 2,
  page120: 120,
});

const PPTX_PROFILE_SLIDES = Object.freeze({
  small: 2,
  slide120: 120,
});

const EXCEL_MAX_COLUMNS = 16_384;
const MULTILINGUAL_PARAGRAPH =
  'English: deterministic Office rendering fixture. 한국어: 합성 성능 문서입니다. 日本語: 合成性能文書です。 中文: 这是合成性能文档。 Tiếng Việt: Đây là tài liệu hiệu năng tổng hợp.';

function buildDocxPage(pageNumber) {
  const page = String(pageNumber).padStart(3, '0');
  return [
    Object.freeze({
      type: 'heading',
      level: 1,
      text: `Synthetic page ${page}`,
    }),
    Object.freeze({
      type: 'paragraph',
      text: `${MULTILINGUAL_PARAGRAPH} Page ${page}.`,
      alignment: 'justify',
    }),
    Object.freeze({
      type: 'rich_paragraph',
      runs: Object.freeze([
        Object.freeze({ text: `Page ${page} summary: `, bold: true }),
        Object.freeze({ text: 'deterministic ', italic: true }),
        Object.freeze({ text: 'Office rendering fixture.', underline: true }),
      ]),
    }),
    Object.freeze({
      type: 'bullet_list',
      ordered: false,
      items: Object.freeze([
        `page ${page} item A`,
        `page ${page} item B`,
        `page ${page} item C`,
      ]),
    }),
    Object.freeze({
      type: 'table',
      headers: Object.freeze(['Page', 'Metric', 'Value']),
      rows: Object.freeze([
        Object.freeze([page, 'latency-sample', pageNumber]),
        Object.freeze([page, 'memory-sample', pageNumber * 2]),
        Object.freeze([page, 'revision-sample', pageNumber * 3]),
        Object.freeze([page, 'render-sample', pageNumber * 4]),
      ]),
    }),
  ];
}

function buildDocxRequest(profile, pages) {
  const blocks = [];
  for (let page = 1; page <= pages; page += 1) {
    blocks.push(...buildDocxPage(page));
    if (page < pages) {
      blocks.push(Object.freeze({ type: 'page_break' }));
    }
  }
  return Object.freeze({
    format: 'docx',
    title: `Inkspan synthetic DOCX benchmark: ${profile}`,
    author: 'Inkspan synthetic benchmark',
    subject: 'Deterministic synthetic performance fixture',
    blocks: Object.freeze(blocks),
  });
}

function buildXlsxRequest(profile) {
  if (profile === 'wide16384') {
    const row = Array.from(
      { length: EXCEL_MAX_COLUMNS },
      (_, index) => `C${String(index + 1).padStart(5, '0')}`,
    );
    return Object.freeze({
      format: 'xlsx',
      title: 'Inkspan synthetic XLSX benchmark: wide16384',
      author: 'Inkspan synthetic benchmark',
      sheets: Object.freeze([
        Object.freeze({
          name: 'Wide16384',
          rows: Object.freeze([Object.freeze(row)]),
          freeze_panes: 'XFD1048576',
        }),
      ]),
    });
  }

  return Object.freeze({
    format: 'xlsx',
    title: 'Inkspan synthetic XLSX benchmark: small',
    author: 'Inkspan synthetic benchmark',
    sheets: Object.freeze([
      Object.freeze({
        name: 'Synthetic',
        header_row: true,
        auto_filter: true,
        freeze_panes: 'B2',
        rows: Object.freeze([
          Object.freeze(['Language', 'Text', 'Latency', 'Memory']),
          Object.freeze(['한국어', '합성 성능 문서', 1, 2]),
          Object.freeze(['日本語', '合成性能文書', 3, 4]),
          Object.freeze(['中文 / Tiếng Việt', '合成文档 / tài liệu tổng hợp', 5, 6]),
        ]),
      }),
    ]),
  });
}

function buildPptxSlide(slideNumber) {
  const slide = String(slideNumber).padStart(3, '0');
  return Object.freeze({
    title: `한국어 합성 슬라이드 ${slide}`,
    bullets: Object.freeze([
      `English deterministic slide ${slide}`,
      Object.freeze({ text: `日本語 合成スライド ${slide}`, level: 0 }),
      Object.freeze({ text: `中文 合成幻灯片 ${slide}`, level: 1 }),
      Object.freeze({ text: `Tiếng Việt trang chiếu ${slide}`, level: 1 }),
    ]),
  });
}

function buildPptxRequest(profile, slides) {
  return Object.freeze({
    format: 'pptx',
    title: `Inkspan synthetic PPTX benchmark: ${profile}`,
    author: 'Inkspan synthetic benchmark',
    slides: Object.freeze(
      Array.from({ length: slides }, (_, index) => buildPptxSlide(index + 1)),
    ),
  });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function resolveOutputDirectory(argv) {
  if (argv.length !== 2 || argv[0] !== '--output' || argv[1].length === 0) {
    throw new Error(
      'Usage: node benchmarks/generate-office-fixtures.mjs --output <directory>',
    );
  }
  return resolve(argv[1]);
}

function writeFixture(outputDirectory, fileName, request, units) {
  const body = `${JSON.stringify(request, null, 2)}\n`;
  const bytes = Buffer.from(body, 'utf8');
  writeFileSync(resolve(outputDirectory, fileName), bytes);
  return Object.freeze({
    units,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
}

const outputDirectory = resolveOutputDirectory(process.argv.slice(2));
mkdirSync(outputDirectory, { recursive: true });

const docx = {};
for (const [profile, pages] of Object.entries(DOCX_PROFILE_PAGES)) {
  docx[profile] = writeFixture(
    outputDirectory,
    `docx-${profile}.json`,
    buildDocxRequest(profile, pages),
    pages,
  );
}

const xlsx = Object.freeze({
  small: writeFixture(
    outputDirectory,
    'xlsx-small.json',
    buildXlsxRequest('small'),
    4,
  ),
  wide16384: writeFixture(
    outputDirectory,
    'xlsx-wide16384.json',
    buildXlsxRequest('wide16384'),
    EXCEL_MAX_COLUMNS,
  ),
});

const pptx = {};
for (const [profile, slides] of Object.entries(PPTX_PROFILE_SLIDES)) {
  pptx[profile] = writeFixture(
    outputDirectory,
    `pptx-${profile}.json`,
    buildPptxRequest(profile, slides),
    slides,
  );
}

const manifest = Object.freeze({
  contractVersion: 1,
  synthetic: true,
  formats: Object.freeze({
    docx: Object.freeze(docx),
    xlsx,
    pptx: Object.freeze(pptx),
  }),
});
writeFileSync(
  resolve(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
