# CommonJS Runtime-Authority Verification

Status: active-PR evidence for PR #290. This note does not describe protected-main shipped behavior until the PR is merged.

## Decision boundary

Inkspan release verification treats executable module lookup or loading authority left in a packed JavaScript artifact as a packaging failure. The verifier parses emitted JavaScript with the TypeScript AST and classifies only statically recognizable syntax. It does not execute artifact code, resolve arbitrary aliases, evaluate receiver expressions, or infer computed member names.

The current active-PR scanner covers static imports/re-exports, dynamic `import(...)`, direct and statically indirect CommonJS `require` forms, `module.require`, `require.main.require`, `require.resolve`, `.call`, `.apply`, `Reflect.apply`, retained `.bind` capabilities, statically composed `.bind` invocations, constructor invocation through `new`, `Reflect.construct` when the target is already a recognized CommonJS loader or resolver, and direct Node `process.getBuiltinModule(...)` / `globalThis.process.getBuiltinModule(...)` calls. A directly recognizable bound CommonJS loader or resolver is therefore rejected when it is retained for later use, before later invocation occurs. Literal module specifiers are retained as actionable evidence; computed or missing specifiers remain unknown rather than being guessed. Ordinary object methods merely named `require`, `resolve`, or `getBuiltinModule` remain outside the authority model.

The `process.getBuiltinModule(...)` classification is intentionally narrow: it recognizes only the ambient `process` spelling and the explicit `globalThis.process` spelling documented by Node.js. It does not resolve aliases, arbitrary receivers, or computed member names, and it does not infer that a similarly named method on another object has Node module authority.

This is a release-evidence boundary, not a runtime loader. It adds no filesystem, network, credential, persistence, deployment, model, or host authority to Inkspan.

## Standards basis

Node.js documents `require()` as the CommonJS module loader, `require.main` as the entry-module reference for CommonJS entry points, and `require.resolve()` as using the internal `require()` resolution machinery without loading the resolved module. These semantics make both loading and resolution relevant executable authority in an artifact expected to be self-contained.

Node.js also documents `process.getBuiltinModule(id)` as a globally available synchronous way to load a Node built-in module, including the explicit `globalThis.process.getBuiltinModule(...)` form for environment-conditional access. Because the packed Markdown artifact is required to be self-contained and free of executable runtime module authority, leaving that syntax in the artifact is a packaging failure even though the target is a Node built-in rather than an external package.

ECMA-262 defines `Function.prototype.bind` as producing a bound function whose target and leading arguments are retained for subsequent calls. That retained callable is already executable loader/resolver authority before later invocation, so a packed artifact that stores a directly recognizable `require.bind(...)` or `require.resolve.bind(...)` capability has not eliminated the authority merely because the call happens later. ECMA-262 also defines `Reflect.apply(target, thisArgument, argumentsList)` as invoking a callable target with an argument list, ordinary `new` expressions as constructor invocation, and `Reflect.construct(target, argumentsList, newTarget)` as construction through an explicitly supplied target. Therefore, a verifier that recognizes only direct `require(...)` or `require.resolve(...)` calls can miss equivalent authority retained or invoked through standard `bind`, `call`/`apply`, `Reflect.apply`, constructor invocation, or `Reflect.construct` composition.

The verifier intentionally remains syntax-bounded. ECMAScript permits arbitrary aliasing and computation; attempting whole-program resolution in this release check would enlarge the trusted implementation and risk unsound guesses. Unknown computed module arguments are therefore reported as executable authority without an invented specifier when the authority surface itself is statically recognizable.

## Assurance implications

The regression suite must include positive cases for each supported syntax family, including retained bound CommonJS loader/resolver capabilities before later invocation and Node built-in loading through both documented ambient process spellings, plus negative controls for ordinary objects with similarly named methods. Invalid emitted JavaScript fails closed. Any extension to the recognized syntax must be test-first and must preserve the no-execution/no-alias-evaluation invariant.

Release acceptance must use the exact packed artifact produced from the exact candidate head. Passing source tests on a predecessor, a different checkout SHA, or a status-only/model-only signal is not evidence that the packed artifact is free of runtime module authority.

## References

Ecma International. (2026). *ECMA-262: ECMAScript® 2026 language specification* (17th ed.). https://262.ecma-international.org/

Node.js contributors. (2026). *Modules: CommonJS modules* (Node.js v26.5.1 documentation). Node.js. https://nodejs.org/api/modules.html

Node.js contributors. (2026). *Process* (Node.js v26.7.0 documentation). Node.js. https://nodejs.org/api/process.html
