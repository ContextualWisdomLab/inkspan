import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, delimiter, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TITLE = 'Inkspan acquisition handoff';
const MARKDOWN = '**Buyer-ready** body.\n\nSecond acquisition paragraph.';
const EXPECTED_BODY = ['Buyer-ready body.', 'Second acquisition paragraph.'];

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} exited with status ${result.status}`,
        result.stdout?.trim(),
        result.stderr?.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

async function main() {
  const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../..',
  );
  const packageEntry = resolve(requiredEnvironment('INKSPAN_BROWSER_PACKAGE_ENTRY'));
  const packageRoot = resolve(dirname(packageEntry), '..');
  const expectedEntry = resolve(packageRoot, 'dist/cwl-editor.js');
  if (packageEntry !== expectedEntry) {
    throw new Error('packed package entry must resolve to dist/cwl-editor.js');
  }

  const packageMetadata = JSON.parse(
    await readFile(resolve(packageRoot, 'package.json'), 'utf8'),
  );
  if (packageMetadata.name !== '@contextualwisdomlab/cwl-editor') {
    throw new Error('packed package has an unexpected package identity');
  }

  const nodeModulesRoot = resolve(packageRoot, '../..');
  const consumerRoot = dirname(nodeModulesRoot);
  const temporaryDirectory = await mkdtemp(
    resolve(consumerRoot, '.inkspan-office-handoff-'),
  );

  try {
    const copiedHandoff = resolve(temporaryDirectory, 'office-handoff.mjs');
    const requestPath = resolve(temporaryDirectory, 'request.json');
    const outputPath = resolve(temporaryDirectory, 'handoff.docx');
    await copyFile(
      resolve(repositoryRoot, 'examples/reference-host/office-handoff.mjs'),
      copiedHandoff,
    );

    const { createReferenceDocxRequest } = await import(
      pathToFileURL(copiedHandoff).href
    );
    const request = createReferenceDocxRequest({
      title: TITLE,
      markdown: MARKDOWN,
    });
    if (
      request.format !== 'docx' ||
      request.title !== TITLE ||
      request.blocks?.length !== EXPECTED_BODY.length ||
      request.blocks.some(
        (block, index) =>
          block?.type !== 'paragraph' || block.text !== EXPECTED_BODY[index],
      )
    ) {
      throw new Error('packed Markdown handoff produced an unexpected Office request');
    }
    await writeFile(requestPath, `${JSON.stringify(request)}\n`, 'utf8');

    const python = process.env.INKSPAN_OFFICE_PYTHON?.trim() || 'python';
    const pythonPath = [
      resolve(repositoryRoot, 'office/src'),
      process.env.PYTHONPATH,
    ]
      .filter(Boolean)
      .join(delimiter);
    const pythonEnvironment = {
      ...process.env,
      PYTHONPATH: pythonPath,
    };

    run(
      python,
      ['-m', 'inkspan_office.cli', requestPath, outputPath],
      { cwd: repositoryRoot, env: pythonEnvironment },
    );

    const validation = `
from pathlib import Path
import sys
from docx import Document

output = Path(sys.argv[1])
if not output.read_bytes().startswith(b"PK"):
    raise SystemExit("Office output is not an OOXML package")
document = Document(output)
if document.core_properties.title != ${JSON.stringify(TITLE)}:
    raise SystemExit("DOCX title metadata does not match the handoff")
paragraphs = [paragraph.text for paragraph in document.paragraphs]
if paragraphs != ${JSON.stringify([TITLE, ...EXPECTED_BODY])}:
    raise SystemExit(f"unexpected DOCX paragraphs: {paragraphs!r}")
`;
    run(python, ['-c', validation, outputPath], {
      cwd: repositoryRoot,
      env: pythonEnvironment,
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

await main();
