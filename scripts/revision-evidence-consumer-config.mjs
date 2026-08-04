/**
 * Build the package manifest used by the independent revision-evidence consumer.
 *
 * The manifest installs the exact packed Inkspan tarball, exact runtime and type
 * dependencies already present in the repository's locked installation, and the
 * exact TypeScript compiler version. Keeping the compiler in the temporary
 * consumer prevents a repository-level `node_modules` directory from satisfying
 * the strict declaration check.
 *
 * @param {object} options - Exact package metadata and dependency versions.
 * @param {string} options.packageName - Published npm package name under test.
 * @param {string} options.packageManager - Exact package-manager declaration.
 * @param {string} options.tarballFileName - Tarball file created by `npm pack`.
 * @param {Record<string, string>} options.exactRuntimeDependencies - Runtime and peer dependency versions.
 * @param {Record<string, string>} options.exactTypeDependencies - Type-package versions required by declarations.
 * @param {string} options.exactTypeScriptVersion - TypeScript compiler version installed in the consumer.
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
