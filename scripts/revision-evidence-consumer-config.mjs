import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Build the package manifest used by the independent revision-evidence consumer.
 *
 * The manifest records the exact packed Inkspan tarball, exact runtime and type
 * dependencies already present in the repository's locked installation, and the
 * exact TypeScript compiler version. Keeping that metadata in the temporary
 * consumer makes the isolated package contract explicit and auditable.
 *
 * @param {object} options - Exact package metadata and dependency versions.
 * @param {string} options.packageName - Published npm package name under test.
 * @param {string} options.packageManager - Exact package-manager declaration.
 * @param {string} options.tarballFileName - Tarball file created by `npm pack`.
 * @param {Record<string, string>} options.exactRuntimeDependencies - Runtime and peer dependency versions.
 * @param {Record<string, string>} options.exactTypeDependencies - Type-package versions required by declarations.
 * @param {string} options.exactTypeScriptVersion - TypeScript compiler version staged in the consumer.
 * @returns {object} A private npm package manifest for the isolated consumer.
 */
export function createIndependentConsumerManifest({
  packageName,
  packageManager,
  tarballFileName,
  exactRuntimeDependencies,
  exactTypeDependencies,
  exactTypeScriptVersion,
}) {
  return {
    name: 'inkspan-revision-evidence-consumer',
    private: true,
    type: 'module',
    packageManager,
    dependencies: {
      [packageName]: `file:./${tarballFileName}`,
      ...exactRuntimeDependencies,
    },
    devDependencies: {
      ...exactTypeDependencies,
      typescript: exactTypeScriptVersion,
    },
  };
}

/**
 * Build a pnpm command that runs the consumer-local TypeScript compiler.
 *
 * The `--dir` option is placed before `exec` so pnpm resolves `tsc` from the
 * temporary consumer's dependency tree instead of the repository installation.
 *
 * @param {string} verificationDirectory - Independent consumer directory.
 * @param {string} consumerPath - Strict TypeScript consumer source file.
 * @returns {string[]} Ordered arguments for `pnpm`.
 */
export function createTypeScriptVerificationArguments(
  verificationDirectory,
  consumerPath,
) {
  return [
    '--dir',
    verificationDirectory,
    'exec',
    'tsc',
    '--noEmit',
    '--strict',
    '--skipLibCheck',
    'false',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ES2022',
    '--lib',
    'ES2022,DOM,DOM.Iterable',
    consumerPath,
  ];
}

/**
 * Copy one frozen-lockfile-verified pnpm dependency tree into a consumer.
 *
 * The complete tree, including pnpm's virtual store and relative symlink graph,
 * is copied without dereferencing links. This avoids a second dependency
 * resolution that could select newer transitive packages absent from the
 * offline store, while keeping every executable and declaration physically
 * inside the operating-system temporary consumer.
 *
 * @param {string} sourceNodeModules - Repository `node_modules` directory.
 * @param {string} targetNodeModules - Consumer `node_modules` destination.
 * @returns {void}
 */
export function stageLockedNodeModules(sourceNodeModules, targetNodeModules) {
  if (!existsSync(sourceNodeModules)) {
    throw new Error('locked source node_modules directory does not exist');
  }
  mkdirSync(dirname(targetNodeModules), { recursive: true });
  cpSync(sourceNodeModules, targetNodeModules, {
    recursive: true,
    dereference: false,
    errorOnExist: true,
    force: false,
    verbatimSymlinks: true,
  });
}
