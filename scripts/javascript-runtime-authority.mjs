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
      if (ts.isIdentifier(receiver) && receiver.text === 'module') {
        return true;
      }
      return (
        (ts.isPropertyAccessExpression(receiver) ||
          ts.isElementAccessExpression(receiver)) &&
        staticMemberName(receiver) === 'main' &&
        isCommonJsLoaderExpression(receiver.expression)
      );
    }
    return false;
  }

  /** Identify statically recognizable CommonJS resolver values. */
  function isCommonJsResolverExpression(expression) {
    const current = unwrapParentheses(expression);
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return isCommonJsResolverExpression(current.right);
    }
    return (
      (ts.isPropertyAccessExpression(current) ||
        ts.isElementAccessExpression(current)) &&
      staticMemberName(current) === 'resolve' &&
      isCommonJsLoaderExpression(current.expression)
    );
  }

  /** Identify the built-in `Reflect.apply` without resolving aliases or receivers. */
  function isReflectApplyExpression(expression) {
    const current = unwrapParentheses(expression);
    if (
      !ts.isPropertyAccessExpression(current) &&
      !ts.isElementAccessExpression(current)
    ) {
      return false;
    }
    const receiver = unwrapParentheses(current.expression);
    return (
      staticMemberName(current) === 'apply' &&
      ts.isIdentifier(receiver) &&
      receiver.text === 'Reflect'
    );
  }

  /**
   * Return the first statically written apply payload argument.
   * Non-array, computed, missing, and spread argument lists still identify
   * executable authority but deliberately yield an unknown module specifier.
   */
  function commonJsApplyArgument(node, argumentListIndex = 1) {
    const argumentList = node.arguments[argumentListIndex];
    if (!argumentList) {
      return undefined;
    }
    const current = unwrapParentheses(argumentList);
    if (!ts.isArrayLiteralExpression(current)) {
      return undefined;
    }
    const first = current.elements[0];
    return first && !ts.isSpreadElement(first) ? first : undefined;
  }

  /**
   * Recognize a statically written `.bind` expression whose receiver is already
   * known module authority. The bound receiver and arguments are never evaluated.
   */
  function commonJsBoundExpression(expression, authorityPredicate) {
    const bindCall = unwrapParentheses(expression);
    if (!ts.isCallExpression(bindCall)) {
      return null;
    }
    const bindCallee = unwrapParentheses(bindCall.expression);
    if (
      (!ts.isPropertyAccessExpression(bindCallee) &&
        !ts.isElementAccessExpression(bindCallee)) ||
      staticMemberName(bindCallee) !== 'bind' ||
      !authorityPredicate(bindCallee.expression)
    ) {
      return null;
    }
    return {
      hasArgument: bindCall.arguments.length > 1,
      argument: bindCall.arguments[1],
    };
  }

  /** Preserve an explicitly bound package argument even when it is computed. */
  function commonJsBoundArgument(boundExpression, fallbackArgument) {
    return boundExpression.hasArgument
      ? boundExpression.argument
      : fallbackArgument;
  }

  /**
   * Recognize an immediately invoked statically written `.bind` call whose
   * receiver is already known module authority. A package argument bound after
   * `thisArg` takes precedence over the first invocation argument.
   */
  function commonJsBoundInvocation(node, authorityPredicate) {
    const boundExpression = commonJsBoundExpression(
      node.expression,
      authorityPredicate,
    );
    return boundExpression
      ? {
          argument: commonJsBoundArgument(
            boundExpression,
            node.arguments[0],
          ),
        }
      : null;
  }

  /**
   * Recognize statically written constructor use of known CommonJS authority.
   * The constructor target and package argument are inspected syntactically only;
   * aliases, arbitrary receivers, and computed property names remain unresolved.
   */
  function commonJsConstructorInvocation(node, authorityPredicate) {
    if (authorityPredicate(node.expression)) {
      return { argument: node.arguments?.[0] };
    }
    const boundExpression = commonJsBoundExpression(
      node.expression,
      authorityPredicate,
    );
    return boundExpression
      ? {
          argument: commonJsBoundArgument(
            boundExpression,
            node.arguments?.[0],
          ),
        }
      : null;
  }

  /**
   * Return the package argument for one recognizable CommonJS resolver call.
   * Arbitrary object methods named `resolve` remain outside this authority model.
   */
  function commonJsResolverInvocation(node) {
    if (isCommonJsResolverExpression(node.expression)) {
      return { argument: node.arguments[0] };
    }

    const boundInvocation = commonJsBoundInvocation(
      node,
      isCommonJsResolverExpression,
    );
    if (boundInvocation) {
      return boundInvocation;
    }

    if (isReflectApplyExpression(node.expression)) {
      const target = node.arguments[0];
      if (target && isCommonJsResolverExpression(target)) {
        return { argument: commonJsApplyArgument(node, 2) };
      }
      if (target) {
        const boundTarget = commonJsBoundExpression(
          target,
          isCommonJsResolverExpression,
        );
        if (boundTarget) {
          return {
            argument: commonJsBoundArgument(
              boundTarget,
              commonJsApplyArgument(node, 2),
            ),
          };
        }
      }
    }

    const callee = unwrapParentheses(node.expression);
    if (
      ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)
    ) {
      const invocationMethod = staticMemberName(callee);
      if (invocationMethod === 'call' || invocationMethod === 'apply') {
        const fallbackArgument =
          invocationMethod === 'call'
            ? node.arguments[1]
            : commonJsApplyArgument(node);
        if (isCommonJsResolverExpression(callee.expression)) {
          return { argument: fallbackArgument };
        }
        const boundReceiver = commonJsBoundExpression(
          callee.expression,
          isCommonJsResolverExpression,
        );
        if (boundReceiver) {
          return {
            argument: commonJsBoundArgument(
              boundReceiver,
              fallbackArgument,
            ),
          };
        }
      }
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

    const boundInvocation = commonJsBoundInvocation(
      node,
      isCommonJsLoaderExpression,
    );
    if (boundInvocation) {
      return boundInvocation;
    }

    if (isReflectApplyExpression(node.expression)) {
      const target = node.arguments[0];
      if (target && isCommonJsLoaderExpression(target)) {
        return { argument: commonJsApplyArgument(node, 2) };
      }
      if (target) {
        const boundTarget = commonJsBoundExpression(
          target,
          isCommonJsLoaderExpression,
        );
        if (boundTarget) {
          return {
            argument: commonJsBoundArgument(
              boundTarget,
              commonJsApplyArgument(node, 2),
            ),
          };
        }
      }
    }

    const callee = unwrapParentheses(node.expression);
    if (
      ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)
    ) {
      const invocationMethod = staticMemberName(callee);
      if (invocationMethod === 'call' || invocationMethod === 'apply') {
        const fallbackArgument =
          invocationMethod === 'call'
            ? node.arguments[1]
            : commonJsApplyArgument(node);
        if (isCommonJsLoaderExpression(callee.expression)) {
          return { argument: fallbackArgument };
        }
        const boundReceiver = commonJsBoundExpression(
          callee.expression,
          isCommonJsLoaderExpression,
        );
        if (boundReceiver) {
          return {
            argument: commonJsBoundArgument(
              boundReceiver,
              fallbackArgument,
            ),
          };
        }
      }
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
    } else if (ts.isNewExpression(node)) {
      const resolverInvocation = commonJsConstructorInvocation(
        node,
        isCommonJsResolverExpression,
      );
      if (resolverInvocation) {
        findings.push({
          kind: 'commonjs-resolve',
          offset: node.getStart(sourceFile),
          specifier: literalSpecifier(resolverInvocation.argument),
        });
      } else {
        const invocation = commonJsConstructorInvocation(
          node,
          isCommonJsLoaderExpression,
        );
        if (invocation) {
          findings.push({
            kind: 'commonjs-require',
            offset: node.getStart(sourceFile),
            specifier: literalSpecifier(invocation.argument),
          });
        }
      }
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
