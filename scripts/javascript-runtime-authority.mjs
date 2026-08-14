import ts from 'typescript';

/**
 * Classify executable module-authority syntax in one emitted JavaScript artifact.
 *
 * Parsing the artifact instead of scanning raw text deliberately ignores comments,
 * string literals, and template text that merely mention `require()` or `import()`.
 * Actual static imports/re-exports, statically recognizable CommonJS loader and
 * resolver calls, and dynamic `import()` calls remain fail-closed findings.
 * Literal module specifiers are preserved in diagnostics so a verifier failure
 * identifies the dependency edge that escaped bundling; computed specifiers remain
 * `undefined` and therefore do not acquire an invented interpretation.
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

  /** Remove syntax-only parentheses without evaluating the expression. */
  function unwrapParentheses(expression) {
    let current = expression;
    while (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    }
    return current;
  }

  /** Return a statically written member name without evaluating property input. */
  function staticMemberName(expression) {
    if (ts.isPropertyAccessExpression(expression)) {
      return expression.name.text;
    }
    if (
      ts.isElementAccessExpression(expression) &&
      expression.argumentExpression &&
      ts.isStringLiteralLike(expression.argumentExpression)
    ) {
      return expression.argumentExpression.text;
    }
    return undefined;
  }

  /** Identify direct CommonJS loader values without resolving aliases or scope. */
  function isCommonJsLoaderExpression(expression) {
    const current = unwrapParentheses(expression);
    if (ts.isIdentifier(current)) {
      return current.text === 'require';
    }
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return isCommonJsLoaderExpression(current.right);
    }
    if (
      (ts.isPropertyAccessExpression(current) ||
        ts.isElementAccessExpression(current)) &&
      staticMemberName(current) === 'require'
    ) {
      const receiver = unwrapParentheses(current.expression);
      return ts.isIdentifier(receiver) && receiver.text === 'module';
    }
    return false;
  }

  /**
   * Return the package argument for one recognizable CommonJS resolver call.
   * Arbitrary object methods named `resolve` remain outside this authority model.
   */
  function commonJsResolverInvocation(node) {
    const callee = unwrapParentheses(node.expression);
    if (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      staticMemberName(callee) === 'resolve' &&
      isCommonJsLoaderExpression(callee.expression)
    ) {
      return { argument: node.arguments[0] };
    }
    return null;
  }

  /**
   * Return the package argument for one recognizable CommonJS loader call.
   * A wrapper object distinguishes a computed or missing argument from no match.
   */
  function commonJsInvocation(node) {
    if (isCommonJsLoaderExpression(node.expression)) {
      return { argument: node.arguments[0] };
    }

    const callee = unwrapParentheses(node.expression);
    if (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      staticMemberName(callee) === 'call' &&
      isCommonJsLoaderExpression(callee.expression)
    ) {
      return { argument: node.arguments[1] };
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
        const resolverInvocation = commonJsResolverInvocation(node);
        if (resolverInvocation) {
          findings.push({
            kind: 'commonjs-resolve',
            offset: node.getStart(sourceFile),
            specifier: literalSpecifier(resolverInvocation.argument),
          });
        } else {
          const invocation = commonJsInvocation(node);
          if (invocation) {
            findings.push({
              kind: 'commonjs-require',
              offset: node.getStart(sourceFile),
              specifier: literalSpecifier(invocation.argument),
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return Object.freeze(findings.map((finding) => Object.freeze(finding)));
}
