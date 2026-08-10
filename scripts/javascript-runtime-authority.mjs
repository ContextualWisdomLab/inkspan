import ts from 'typescript';

/**
 * Classify executable module-authority syntax in one emitted JavaScript artifact.
 *
 * Parsing the artifact instead of scanning raw text deliberately ignores comments,
 * string literals, and template text that merely mention `require()` or `import()`.
 * Actual static imports/re-exports, bare CommonJS `require()` calls, and dynamic
 * `import()` calls remain fail-closed findings.
 *
 * @param {string} source JavaScript source emitted into the packed artifact.
 * @param {string} [filename='bundle.js'] Diagnostic filename for parse failures.
 * @returns {ReadonlyArray<{kind: string, offset: number, specifier?: string}>}
 *   Executable module-authority findings in source order.
 * @throws {SyntaxError} When the emitted JavaScript cannot be parsed.
 */
export function findRuntimeModuleAuthority(source, filename = 'bundle.js') {
  const sourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );

  const diagnostics = sourceFile.parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    const first = diagnostics[0];
    const message = ts.flattenDiagnosticMessageText(first.messageText, '\n');
    throw new SyntaxError(`${filename} is not valid JavaScript: ${message}`);
  }

  const findings = [];

  /** @param {import('typescript').Node} node Parsed JavaScript node. */
  function visit(node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      findings.push({
        kind: 'static-import',
        offset: node.getStart(sourceFile),
        specifier: ts.isStringLiteralLike(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : undefined,
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      findings.push({
        kind: 'static-reexport',
        offset: node.getStart(sourceFile),
        specifier: ts.isStringLiteralLike(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : undefined,
      });
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        findings.push({
          kind: 'dynamic-import',
          offset: node.getStart(sourceFile),
        });
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require'
      ) {
        findings.push({
          kind: 'commonjs-require',
          offset: node.getStart(sourceFile),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return Object.freeze(findings.map((finding) => Object.freeze(finding)));
}
