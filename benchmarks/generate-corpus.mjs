import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const RASTER_FIXTURES = Object.freeze([
  Object.freeze({
    dimensions: '1x1',
    base64:
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQcEj4DwADBAHAX3ZiygAAAABJRU5ErkJggg==',
  }),
  Object.freeze({
    dimensions: '16x16',
    base64:
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR42mNQcEj4TwlmGDVg1IBRA4aLAQDSpr8QG8NsyQAAAABJRU5ErkJggg==',
  }),
  Object.freeze({
    dimensions: '64x64',
    base64:
      'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAZklEQVR42u3QQREAAAQAMFFEEUX/EuRw9liBRVbPZyFAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgTct/Bk8ZbOy3oMAAAAAElFTkSuQmCC',
  }),
]);
const SCRIPT_PARAGRAPHS = [
  'English: Deterministic authoring keeps document state explicit and reviewable.',
  '한국어: 결정적 작성 흐름은 문서 상태와 변경 근거를 명확하게 유지합니다.',
  '日本語: 決定的な編集フローは文書状態と変更根拠を明示的に保ちます。',
  '中文: 确定性的编辑流程会明确保留文档状态与变更依据。',
  'Tiếng Việt: Luồng biên soạn xác định giữ trạng thái tài liệu và bằng chứng thay đổi rõ ràng.',
  'Mixed-script: Inkspan review 검증은 日本語と中文 그리고 Tiếng Việt를 한 문단에서 deterministic하게 다룹니다.',
];
const PROFILE_SECTIONS = Object.freeze({
  small: 1,
  medium: 8,
  large: 32,
  stress: 128,
});
const SCRIPT_LABELS = Object.freeze([
  'English',
  'Korean',
  'Japanese',
  'Chinese',
  'Vietnamese',
  'mixed',
]);

let outputWriteCounter = 0;

function writeRegularOutput(path, content) {
  const existing = lstatSync(path, { throwIfNoEntry: false });
  if (existing !== undefined && !existing.isFile()) {
    throw new Error('Benchmark corpus output must be a regular file.');
  }

  const temporaryPath = `${path}.tmp-${process.pid}-${outputWriteCounter}`;
  outputWriteCounter += 1;
  try {
    writeFileSync(temporaryPath, content, { flag: 'wx' });
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function buildSection(index) {
  const id = String(index).padStart(4, '0');
  const tableRows = Array.from({ length: 4 }, (_, rowIndex) => {
    const row = String(rowIndex + 1).padStart(2, '0');
    return `| ${id}-r${row}c01 | ${id}-r${row}c02 | ${id}-r${row}c03 | ${id}-r${row}c04 | ${id}-r${row}c05 | ${id}-r${row}c06 |`;
  });
  const rasterRows = RASTER_FIXTURES.map(
    ({ dimensions, base64 }) =>
      `![synthetic raster ${dimensions} ${id}](data:image/png;base64,${base64})`,
  );
  return [
    `# Synthetic section ${id}`,
    '',
    ...SCRIPT_PARAGRAPHS,
    '',
    `## Nested list ${id}`,
    `- item ${id}-a`,
    `  - item ${id}-a-1`,
    `  - item ${id}-a-2`,
    `- item ${id}-b`,
    '',
    `> Synthetic blockquote ${id}: benchmark text only; no production content.`,
    '',
    '```text',
    `fixture=${id}; authority=none; network=none`,
    '```',
    '',
    `[synthetic safe link ${id}](https://example.invalid/inkspan/${id})`,
    '',
    '| c01 | c02 | c03 | c04 | c05 | c06 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...tableRows,
    '',
    ...rasterRows,
    '',
    '---',
    '',
  ].join('\n');
}

function buildProfile(profile, sectionCount) {
  return [
    `# Inkspan deterministic benchmark fixture: ${profile}`,
    '',
    'Synthetic fixture only. No customer, tenant, prompt, credential, or model data.',
    'Scripts: English, Korean, Japanese, Chinese, Vietnamese, and mixed-script structure.',
    '',
    ...Array.from({ length: sectionCount }, (_, index) => buildSection(index + 1)),
  ].join('\n');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function resolveOutputDirectory(argv) {
  if (argv.length !== 2 || argv[0] !== '--output' || argv[1].length === 0) {
    throw new Error('Usage: node benchmarks/generate-corpus.mjs --output <directory>');
  }
  return resolve(argv[1]);
}

const outputDirectory = resolveOutputDirectory(process.argv.slice(2));
mkdirSync(outputDirectory, { recursive: true });

const profileManifest = {};
for (const [profile, sections] of Object.entries(PROFILE_SECTIONS)) {
  const body = buildProfile(profile, sections);
  const bytes = Buffer.from(body, 'utf8');
  writeRegularOutput(resolve(outputDirectory, `${profile}.md`), bytes);
  profileManifest[profile] = Object.freeze({
    sections,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
}

const manifest = Object.freeze({
  contractVersion: 1,
  synthetic: true,
  scripts: SCRIPT_LABELS,
  profiles: profileManifest,
});
writeRegularOutput(
  resolve(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
