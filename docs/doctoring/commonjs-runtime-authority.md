# CommonJS Runtime-Authority Verification

Status: active-PR evidence for PR #290. This note does not describe protected-main shipped behavior until the PR is merged.

## Decision boundary

Inkspan release verification treats executable module lookup or loading authority left in a packed JavaScript artifact as a packaging failure. The verifier parses emitted JavaScript with the TypeScript AST and classifies only statically recognizable syntax. It does not execute artifact code, resolve arbitrary aliases, evaluate receiver expressions, or infer dynamic computed member names.

The current active-PR scanner covers static imports/re-exports, dynamic `import(...)`, direct and statically indirect CommonJS `require` forms, `module.require`, `require.main.require`, `require.resolve`, `.call`, `.apply`, `Reflect.apply`, retained `.bind` capabilities, statically composed `.bind` invocations, constructor invocation through `new`, `Reflect.construct` when the target is already a recognized CommonJS loader or resolver, and Node `process.getBuiltinModule(...)` / `globalThis.process.getBuiltinModule(...)` authority through direct calls, comma-indirected calls whose right operand is one of those exact ambient loader expressions, exact-receiver `.call(...)` / `.apply(...)`, `Reflect.apply(...)`, retained `.bind(...)` capabilities, and immediately invoked bound capabilities. A directly recognizable bound CommonJS or Node built-in loader/resolver is therefore rejected when it is retained for later use, before later invocation occurs. Literal module specifiers are retained as actionable evidence; computed or missing specifiers remain unknown rather than being guessed. Static string-literal element access may identify an already-supported member spelling. Ordinary object methods merely named `require`, `resolve`, or `getBuiltinModule` remain outside the authority model.

The `process.getBuiltinModule(...)` classification is intentionally narrow: it recognizes only the ambient `process` spelling and the explicit `globalThis.process` spelling documented by Node.js, plus syntax-only comma indirection that preserves one of those exact expressions as the right operand, and standard invocation/retention syntax when the receiver/target is one of those exact loader expressions. It does not resolve aliases, arbitrary receivers, or dynamic computed member names, and it does not infer that a similarly named method on another object has Node module authority.

This is a release-evidence boundary, not a runtime loader. It adds no filesystem, network, credential, persistence, deployment, model, or host authority to Inkspan.

## Standards basis

Node.js documents `require()` as the CommonJS module loader, `require.main` as the entry-module reference for CommonJS entry points, and `require.resolve()` as using the internal `require()` resolution machinery without loading the resolved module. These semantics make both loading and resolution relevant executable authority in an artifact expected to be self-contained.

Node.js also documents `process.getBuiltinModule(id)` as a globally available synchronous way to load a Node built-in module, including the explicit `globalThis.process.getBuiltinModule(...)` form for environment-conditional access. Because the packed Markdown artifact is required to be self-contained and free of executable runtime module authority, leaving that authority in the artifact is a packaging failure even though the target is a Node built-in rather than an external package.

ECMA-262 defines `Function.prototype.bind` as producing a bound function whose target and leading arguments are retained for subsequent calls. That retained callable is already executable loader/resolver authority before later invocation, so a packed artifact that stores a directly recognizable `require.bind(...)`, `require.resolve.bind(...)`, or ambient `process.getBuiltinModule.bind(...)` capability has not eliminated the authority merely because the call happens later. ECMA-262 also defines `Function.prototype.call` and `Function.prototype.apply` as invoking their callable receiver with explicit receiver/argument data, `Reflect.apply(target, thisArgument, argumentsList)` as invoking a callable target with an argument list, ordinary `new` expressions as constructor invocation, and `Reflect.construct(target, argumentsList, newTarget)` as construction through an explicitly supplied target. Therefore, a verifier that recognizes only direct loader calls can miss equivalent statically recognizable authority invoked through standard `call`/`apply`/`Reflect.apply` or retained/composed through standard `bind` forms.

The verifier intentionally remains syntax-bounded. ECMAScript permits arbitrary aliasing and computation; attempting whole-program resolution in this release check would enlarge the trusted implementation and risk unsound guesses. Unknown computed module arguments are therefore reported as executable authority without an invented specifier when the authority surface itself is statically recognizable.

## Assurance implications

The regression suite must include positive cases for each supported syntax family, including retained bound CommonJS loader/resolver capabilities before later invocation and Node built-in loading through both documented ambient process spellings, direct and comma-indirected calls, exact-receiver `.call(...)` / `.apply(...)`, `Reflect.apply(...)`, retained `.bind(...)`, and immediate bound invocation, plus negative controls for ordinary objects with similarly named methods. Invalid emitted JavaScript fails closed. Any extension to the recognized syntax must be test-first and must preserve the no-execution/no-alias-evaluation invariant.

Release acceptance must use the exact packed artifact produced from the exact candidate head. Passing source tests on a predecessor, a different checkout SHA, or a status-only/model-only signal is not evidence that the packed artifact is free of runtime module authority.

## References

Ecma International. (2026). *ECMA-262: ECMAScript® 2026 language specification* (17th ed.). https://262.ecma-international.org/

Node.js contributors. (2026). *Modules: CommonJS modules* (Node.js v26.5.1 documentation). Node.js. https://nodejs.org/api/modules.html

Node.js contributors. (2026). *Process* (Node.js v26.7.0 documentation). Node.js. https://nodejs.org/api/process.html
