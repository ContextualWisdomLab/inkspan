# Package distribution and consumer contract

Inkspan publishes the React editor, provider-neutral collaboration adapter,
framework-independent revision evidence and converter surfaces, CSS, and offline
font assets from one npm package. This document defines the supported package
boundary for standalone applications, CWL organization services, and naruon
integrations.

## Public entrypoints

| Subpath | Runtime contract |
| --- | --- |
| `@contextualwisdomlab/cwl-editor` | React editor, serializers, safe-link and inline-image policy APIs |
| `@contextualwisdomlab/cwl-editor/collaboration` | Optional Yjs collaboration surface with host-owned transport and lifecycle |
| `@contextualwisdomlab/cwl-editor/converter` | Framework-independent base64 and data-URI utilities |
| `@contextualwisdomlab/cwl-editor/revision-evidence` | Framework-independent strict envelope parsing, canonicalization, and SHA-256 revision-envelope evidence |
| `@contextualwisdomlab/cwl-editor/styles.css` | Editor layout and theming |
| `@contextualwisdomlab/cwl-editor/fonts.css` | Full offline KR/EN/JP/SC/TC/VI font bundle |
| `@contextualwisdomlab/cwl-editor/fonts-latin.css` | Smaller Latin/Vietnamese font bundle |
| `@contextualwisdomlab/cwl-editor/fonts/*` | Public font files, license, and attribution assets |

The root, collaboration, converter, and revision-evidence JavaScript entrypoints
support both ESM `import` and CommonJS `require`. Their TypeScript declarations
are selected by the corresponding `types` export condition. Consumers must
import only declared subpaths; internal source paths are not a compatibility
contract.

Pure server, worker, migration, queue, and storage modules should import
`revision-evidence` instead of the root editor surface. The root retains the
same pure functions for source compatibility, while the explicit subpath avoids
evaluating editor-framework modules and keeps MSA ownership boundaries visible
in dependency graphs and software bills of materials.

## Published contents

The npm tarball contains:

- compiled ESM and CommonJS runtime artifacts and source maps;
- generated TypeScript declarations;
- the built editor stylesheet;
- public offline font CSS, binaries, license, and attribution files;
- integration/security documentation, README, package metadata, and MIT license.

The npm tarball intentionally excludes internal TypeScript implementation,
unit/integration tests, coverage output, demo sources and builds, GitHub
workflows, and the separate Python Office distribution. This keeps install size
and audit scope aligned with the JavaScript product boundary while preserving
all explicitly exported assets.

Inkspan Office remains a separate Python distribution under `office/`; it is not
embedded in the npm tarball.

## Runtime dependency boundaries

- React and React DOM are peer dependencies so a host supplies its own compatible
  application runtime.
- `@tiptap/core` is an externalized runtime dependency used by the root editor
  and collaboration entrypoints. It is declared in Inkspan's package
  dependencies so the consumer's package manager installs and resolves it; it
  is not merely a type-only dependency.
- The converter entrypoint is framework-independent and does not import or
  require `@tiptap/core`, React, TipTap extensions, or Yjs.
- The revision-evidence entrypoint bundles only Inkspan's strict envelope parser,
  canonicalizer, and SHA-256 orchestration. It does not import or require React,
  TipTap, ProseMirror, Yjs, transport, credentials, persistence, or provider SDKs.
- Revision-evidence declarations use Inkspan-owned recursive JSON contracts and
  therefore do not require React or TipTap type packages in strict non-editor
  consumers.
- The collaboration entrypoint is optional. Standalone consumers do not need to
  import it, and bundlers can retain the separate dependency boundary.
- Importing any JavaScript entrypoint in Node.js must not require a browser DOM.
  Browser-only work begins when a host mounts the editor or calls APIs that
  explicitly consume browser objects such as `File` or `Blob`.
- CSS and font entrypoints resolve as files and are not executable JavaScript.

Inkspan owns deterministic conversion and editor surfaces. Hosts retain
transport, authorization, tenant isolation, persistence, credentials, migration,
retention, audit, and model-use policy. A dependency-free revision-evidence
entrypoint does not transfer those responsibilities into Inkspan.

## Release verification

Every pull request and main-branch build executes `pnpm verify:package` after the
production library build. The verifier:

1. runs `npm pack --dry-run --json --ignore-scripts` and inspects the exact npm
   manifest;
2. confirms every `main`, `module`, `types`, and `exports` target exists;
3. confirms required licenses, declarations, styles, and font assets ship;
4. rejects internal source, tests, demos, Office files, coverage output, and
   workflow files from the npm tarball;
5. imports the root, collaboration, converter, and revision-evidence entrypoints
   using ESM in a DOM-free Node process;
6. loads the same JavaScript entrypoints using CommonJS;
7. resolves public CSS and font subpaths;
8. compiles a strict TypeScript consumer against all four declaration surfaces;
9. creates the exact npm tarball and extracts only the package under an
   operating-system temporary consumer outside the repository;
10. executes real object and strict UTF-8 revision-evidence operations through
    packed ESM and CommonJS while React, TipTap, and repository ancestor modules
    are absent; and
11. compiles a strict standalone declaration consumer without installing editor
    or framework dependencies.

The isolated consumer proves the tested tarball cannot silently satisfy a
framework import or declaration through package self-reference or an ancestor
`node_modules` directory. It does not replace release checksums, provenance,
security review, or host integration tests.

A version is release-ready only when this package gate, repository-wide 100%
TypeScript coverage, production builds, the Python Office matrix, and required
security checks pass on the current commit.

## Compatibility changes

Removing or renaming an export, changing a declaration incompatibly, making an
optional entrypoint pull in a previously absent runtime dependency, or deleting
a documented packaged asset is a breaking change. Additive exports and internal
implementation changes remain subject to semantic-versioning review based on
observable consumer behavior.

## References (APA 7th edition)

Node.js. (2026). *Modules: CommonJS modules*. Retrieved August 4, 2026, from
https://nodejs.org/api/modules.html

Node.js. (2026). *Modules: Packages*. Retrieved August 4, 2026, from
https://nodejs.org/api/packages.html

npm, Inc. (2026). *npm pack*. Retrieved August 4, 2026, from
https://docs.npmjs.com/cli/v11/commands/npm-pack

npm, Inc. (2026). *npm publish*. Retrieved August 4, 2026, from
https://docs.npmjs.com/cli/v11/commands/npm-publish
