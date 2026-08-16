import ts from 'typescript';

/**
 * Classify executable module-authority syntax in one emitted JavaScript artifact.
 *
 * Parsing the artifact instead of scanning raw text deliberately ignores comments,
 * string literals, and template text that merely mention `require()` or `import()`.
 * Actual static imports/re-exports, statically recognizable CommonJS loader calls,
 * and dynamic `import()` calls remain fail-closed findings. Literal module specifiers
 * are preserved in diagnostics so a verifier failure identifies the dependency edge
 * that escaped bundling; computed specifiers remain `undefined` and therefore do not
 * acquire an invented interpretation.
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

  /** Return a literal module specifier without evaluating computed expressions. */
  function literalSpecifier(expression) {
    return expression && ts.isStringLiteralLike(expression)
      ? expression.text
      : undefined;
  }

  /** Remove syntax-only parentheses before classifying an executable reference. */
  function unwrapParentheses(expression) {
    let current = expression;
    while (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    }
    return current;
  }

  /**
   * Return whether an expression statically denotes a CommonJS loader function.
   *
   * Only intrinsic `require`, exact `module.require`, and comma expressions whose
   * final value is one of those references are accepted. Arbitrary object methods
   * named `require` remain outside this authority classifier.
   */
  function isCommonJsLoaderReference(expression) {
    const current = unwrapParentheses(expression);
    if (ts.isIdentifier(current) && current.text === 'require') {
      return true;
    }
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return isCommonJsLoaderReference(current.right);
    }
    if (
      ts.isPropertyAccessExpression(current) &&
      ts.isIdentifier(unwrapParentheses(current.expression)) &&
      unwrapParentheses(current.expression).text === 'module' &&
      current.name.text === 'require'
    ) {
      return true;
    }
    if (
      ts.isElementAccessExpression(current) &&
      ts.isIdentifier(unwrapParentheses(current.expression)) &&
      unwrapParentheses(current.expression).text === 'module' &&
      literalSpecifier(current.argumentExpression) === 'require'
    ) {
      return true;
    }
    return false;
  }

  /**
   * Resolve the specifier-bearing argument for a recognized CommonJS call.
   *
   * A matched call may legitimately have no literal argument, so the result uses
   * an explicit object instead of overloading `undefined` as the no-match signal.
   */
  function commonJsCall(node) {
    const callee = unwrapParentheses(node.expression);
    if (isCommonJsLoaderReference(callee)) {
      return { specifierExpression: node.arguments[0] };
    }
    if (
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === 'call' &&
      isCommonJsLoaderReference(callee.expression)
    ) {
      return { specifierExpression: node.arguments[1] };
    }
    return null;
  }

  /** @param {import('typescript').Node} node Parsed JavaScript node. */
  function visit(node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      findings.push({
        kind: 'static-import',
        offset: node.getStart(sourceFile),
        specifier: literalSpecifier(node.moduleSpecifier),
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      findings.push({
        kind: 'static-reexport',
        offset: node.getStart(sourceFile),
        specifier: literalSpecifier(node.moduleSpecifier),
      });
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        findings.push({
          kind: 'dynamic-import',
          offset: node.getStart(sourceFile),
          specifier: literalSpecifier(node.arguments[0]),
        });
      } else {
        const commonJs = commonJsCall(node);
        if (commonJs) {
          findings.push({
            kind: 'commonjs-require',
            offset: node.getStart(sourceFile),
            specifier: literalSpecifier(commonJs.specifierExpression),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return Object.freeze(findings.map((finding) => Object.freeze(finding)));
}