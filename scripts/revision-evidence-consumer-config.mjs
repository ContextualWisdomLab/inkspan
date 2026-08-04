import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

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
 * is copied without dereferencing links. A later pruning step limits which
 * direct packages are visible from the consumer while preserving the exact
 * transitive closure selected by the repository lockfile.
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

/**
 * Remove undeclared top-level packages from a staged pnpm dependency tree.
 *
 * pnpm's hidden virtual store is retained because direct package symlinks and
 * their exact transitive dependencies point into it. Only explicitly allowed
 * direct package links remain visible to Node.js and TypeScript from the
 * temporary consumer. Hidden pnpm metadata and command shims are also retained;
 * the verifier separately proves that the selected compiler and package paths
 * resolve inside the consumer tree.
 *
 * @param {string} targetNodeModules - Staged consumer `node_modules` directory.
 * @param {readonly string[]} allowedPackageNames - Exact unscoped or scoped direct package names.
 * @returns {void}
 */
export function pruneTopLevelConsumerDependencies(
  targetNodeModules,
  allowedPackageNames,
) {
  if (!existsSync(targetNodeModules)) {
    throw new Error('staged consumer node_modules directory does not exist');
  }

  const allowedUnscopedPackages = new Set();
  const allowedScopedPackages = new Map();
  for (const packageName of allowedPackageNames) {
    const packageSegments = packageName.split('/');
    if (packageName.startsWith('@')) {
      if (packageSegments.length !== 2 || packageSegments.some((part) => !part)) {
        throw new Error(`invalid scoped consumer dependency name: ${packageName}`);
      }
      const [packageScope, scopedName] = packageSegments;
      const allowedNames = allowedScopedPackages.get(packageScope) ?? new Set();
      allowedNames.add(scopedName);
      allowedScopedPackages.set(packageScope, allowedNames);
      continue;
    }
    if (packageSegments.length !== 1 || !packageSegments[0]) {
      throw new Error(`invalid consumer dependency name: ${packageName}`);
    }
    allowedUnscopedPackages.add(packageName);
  }

  for (const topLevelEntry of readdirSync(targetNodeModules)) {
    if (topLevelEntry.startsWith('.')) continue;
    const topLevelPath = join(targetNodeModules, topLevelEntry);
    if (!topLevelEntry.startsWith('@')) {
      if (!allowedUnscopedPackages.has(topLevelEntry)) {
        rmSync(topLevelPath, { recursive: true, force: true });
      }
      continue;
    }

    const allowedScopedNames = allowedScopedPackages.get(topLevelEntry);
    if (!allowedScopedNames) {
      rmSync(topLevelPath, { recursive: true, force: true });
      continue;
    }
    for (const scopedEntry of readdirSync(topLevelPath)) {
      if (!allowedScopedNames.has(scopedEntry)) {
        rmSync(join(topLevelPath, scopedEntry), {
          recursive: true,
          force: true,
        });
      }
    }
    if (readdirSync(topLevelPath).length === 0) {
      rmSync(topLevelPath, { recursive: true, force: true });
    }
  }
}
