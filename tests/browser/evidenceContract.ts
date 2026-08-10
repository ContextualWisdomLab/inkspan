import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Maximum accepted sanitizer time for the representative Word-like browser fixture. */
export const BROWSER_PERFORMANCE_BUDGET_MILLIS = 8_000;

/** Evidence schema version for one browser-engine release observation file. */
export const BROWSER_EVIDENCE_SCHEMA_VERSION = 2;

/**
 * Resolve the exact packed npm artifact digest when a release artifact is present.
 *
 * Ordinary pull-request browser CI has no `release/` directory and therefore
 * returns `null`. The tag release lane must expose exactly one `.tgz`; its digest
 * is recomputed from bytes rather than trusting a propagated environment value.
 */
export async function packedPackageSha256(repositoryRoot: string): Promise<string | null> {
  const releaseDirectory = resolve(repositoryRoot, 'release');
  let entries;
  try {
    entries = await readdir(releaseDirectory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  const packageFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
    .map((entry) => entry.name)
    .sort();
  if (packageFiles.length !== 1) {
    throw new Error('Cross-engine release evidence requires exactly one packed npm artifact.');
  }

  const digest = createHash('sha256');
  await new Promise<void>((resolveStream, rejectStream) => {
    const stream = createReadStream(resolve(releaseDirectory, packageFiles[0] ?? ''));
    stream.on('data', (chunk) => digest.update(chunk));
    stream.once('error', rejectStream);
    stream.once('end', resolveStream);
  });
  const actualDigest = digest.digest('hex');
  const propagatedDigest = process.env.INKSPAN_EXPECTED_PACKAGE_SHA256?.trim();
  if (propagatedDigest && propagatedDigest !== actualDigest) {
    throw new Error('Packed npm artifact digest does not match propagated release evidence.');
  }
  return actualDigest;
}
