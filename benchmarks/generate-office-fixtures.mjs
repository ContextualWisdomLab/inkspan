import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROFILE_PAGES = Object.freeze({
  small: 2,
  page120: 120,
});

const MULTILINGUAL_PARAGRAPH =
  'English: deterministic Office rendering fixture. 한국어: 합성 성능 문서입니다. 日本語: 合成性能文書です。 中文: 这是合成性能文档。 Tiếng Việt: Đây là tài liệu hiệu năng tổng hợp.';

function buildPage(pageNumber) {
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

function buildRequest(profile, pages) {
  const blocks = [];
  for (let page = 1; page <= pages; page += 1) {
    blocks.push(...buildPage(page));
    if (page < pages) {
      blocks.push(Object.freeze({ type: 'page_break' }));
    }
  }
  return Object.freeze({
    format: 'docx',
    title: `Inkspan synthetic Office benchmark: ${profile}`,
    author: 'Inkspan synthetic benchmark',
    subject: 'Deterministic synthetic performance fixture',
    blocks: Object.freeze(blocks),
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

const outputDirectory = resolveOutputDirectory(process.argv.slice(2));
mkdirSync(outputDirectory, { recursive: true });

const profileManifest = {};
for (const [profile, pages] of Object.entries(PROFILE_PAGES)) {
  const request = buildRequest(profile, pages);
  const body = `${JSON.stringify(request, null, 2)}\n`;
  const bytes = Buffer.from(body, 'utf8');
  writeFileSync(resolve(outputDirectory, `${profile}.json`), bytes);
  profileManifest[profile] = Object.freeze({
    pages,
    blocks: request.blocks.length,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
}

const manifest = Object.freeze({
  contractVersion: 1,
  synthetic: true,
  format: 'docx',
  profiles: profileManifest,
});
writeFileSync(
  resolve(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
