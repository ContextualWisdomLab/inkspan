import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const browserDirectory = dirname(fileURLToPath(import.meta.url));
const evidenceDirectory = resolve(browserDirectory, '.browser-evidence');

/** Build one opaque run identity shared by all browser projects in this invocation. */
function browserEvidenceRunId(): string {
  const githubRunId = process.env.GITHUB_RUN_ID?.trim();
  if (!githubRunId) return randomUUID();
  const attempt = process.env.GITHUB_RUN_ATTEMPT?.trim() || '1';
  const head = process.env.INKSPAN_EXPECTED_HEAD_SHA?.trim() || process.env.GITHUB_SHA?.trim() || 'unknown-head';
  return `${githubRunId}:${attempt}:${head}`;
}

/** Clear predecessor-run evidence before any browser project can produce current evidence. */
export default async function globalSetup(): Promise<void> {
  await rm(evidenceDirectory, { recursive: true, force: true });
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(resolve(evidenceDirectory, '.run-id'), `${browserEvidenceRunId()}\n`, 'utf8');
}
