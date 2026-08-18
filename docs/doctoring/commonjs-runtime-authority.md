# CommonJS Runtime-Authority Verification

Status: active-PR evidence for PR #290. This note does not describe protected-main shipped behavior until the PR is merged.

## Decision boundary

Inkspan release verification treats executable module lookup or loading authority left in a packed JavaScript artifact as a packaging failure. The verifier parses emitted JavaScript with the TypeScript AST and classifies only statically recognizable syntax. It does not execute artifact code, resolve arbitrary aliases, evaluate receiver expressions, or infer computed member names.

The current active-PR scanner covers static imports/re-exports, dynamic `import(...)`, direct and statically indirect CommonJS `require` forms, `module.require`, `require.main.require`, `require.resolve`, `.call`, `.apply`, `Reflect.apply`, statically composed `.bind` invocations, constructor invocation through `new`, and `Reflect.construct` when the target is already a recognized CommonJS loader or resolver. Literal package arguments are retained as actionable evidence; computed arguments remain unknown rather than being guessed. Ordinary object methods merely named `require` or `resolve` remain outside the authority model.

This is a release-evidence boundary, not a runtime loader. It adds no filesystem, network, credential, persistence, deployment, model, or host authority to Inkspan.

## Standards basis

Node.js documents `require()` as the CommonJS module loader, `require.main` as the entry-module reference for CommonJS entry points, and `require.resolve()` as using the internal `require()` resolution machinery without loading the resolved module. These semantics make both loading and resolution relevant executable authority in an artifact expected to be self-contained.

ECMA-262 defines `Function.prototype.bind` as producing a bound function whose target and leading arguments are retained for subsequent calls. It defines `Reflect.apply(target, thisArgument, argumentsList)` as invoking a callable target with an argument list, ordinary `new` expressions as constructor invocation, and `Reflect.construct(target, argumentsList, newTarget)` as construction through an explicitly supplied target. Therefore, a verifier that recognizes only direct `require(...)` or `require.resolve(...)` calls can miss equivalent authority when those same callable values are invoked through standard `bind`, `call`/`apply`, `Reflect.apply`, constructor invocation, or `Reflect.construct` composition.

The verifier intentionally remains syntax-bounded. ECMAScript permits arbitrary aliasing and computation; attempting whole-program resolution in this release check would enlarge the trusted implementation and risk unsound guesses. Unknown computed package arguments are therefore reported as executable authority without an invented specifier.

## Assurance implications

The regression suite must include positive cases for each supported syntax family and negative controls for ordinary objects with similarly named methods. Invalid emitted JavaScript fails closed. Any extension to the recognized syntax must be test-first and must preserve the no-execution/no-alias-evaluation invariant.

Release acceptance must use the exact packed artifact produced from the exact candidate head. Passing source tests on a predecessor, a different checkout SHA, or a status-only/model-only signal is not evidence that the packed artifact is free of runtime module authority.

## References

Ecma International. (2026). *ECMA-262: ECMAScript® 2026 language specification* (17th ed.). https://262.ecma-international.org/

Node.js contributors. (2026). *Modules: CommonJS modules* (Node.js v26.5.1 documentation). Node.js. https://nodejs.org/api/modules.html
