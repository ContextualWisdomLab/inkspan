# Package distribution and consumer contract

Inkspan publishes the React editor, provider-neutral collaboration adapter,
framework-independent autosave/evidence/converter utilities, CSS, and offline
font assets from one npm package. This document defines the supported package
boundary for standalone applications, CWL organization services, and naruon
integrations.

## Public entrypoints

| Subpath | Runtime contract |
| --- | --- |
| `@contextualwisdomlab/cwl-editor` | React editor, serializers, safe-link and inline-image policy APIs, envelope and revision helpers |
| `@contextualwisdomlab/cwl-editor/autosave` | Framework-independent autosave queue/session APIs for bounded local save ordering and host-owned durable concurrency |
| `@contextualwisdomlab/cwl-editor/collaboration` | Optional Yjs collaboration surface with host-owned transport and lifecycle |
| `@contextualwisdomlab/cwl-editor/converter` | Framework-independent base64 and data-URI utilities |
| `@contextualwisdomlab/cwl-editor/envelope-identity` | Framework-independent identity-only envelope routing for bounded schema identity inspection; migration remains host-owned |
| `@contextualwisdomlab/cwl-editor/revision-evidence` | Framework-independent revision evidence and document-transition evidence for local content equality/lineage claims |
| `@contextualwisdomlab/cwl-editor/text-position-selector` | `implemented_on_protected_main` — React-free text-position projection core implementing W3C `TextPositionSelector`; interactive capture, revision binding, authorization, persistence, and re-anchoring remain outside this subpath |
| `@contextualwisdomlab/cwl-editor/markdown` | `implemented_on_active_pr` — headless deterministic Markdown/HTML/email/plain-text conversion with the same safe-link and strict inline-raster policies as the editor, without importing the React/TipTap editor graph |
| `@contextualwisdomlab/cwl-editor/spreadsheet` | `implemented_on_active_pr` — framework-neutral bounded XLS/XLSX envelope preflight, lazy official SheetJS parse, and parser-neutral worksheet-to-editor JSON conversion used by the toolbar to insert visible worksheet tables; not protected-main authority |
| `@contextualwisdomlab/cwl-editor/styles.css` | Editor layout and theming |
| `@contextualwisdomlab/cwl-editor/fonts.css` | Full offline KR/EN/JP/SC/TC/VI font bundle |
| `@contextualwisdomlab/cwl-editor/fonts-latin.css` | Smaller Latin/Vietnamese font bundle |
| `@contextualwisdomlab/cwl-editor/fonts/*` | Public font files, license, and attribution assets |

Every declared `package.json` export must remain discoverable in this table. The
root and JavaScript subpaths support both ESM `import` and CommonJS `require`
where their export map declares both conditions. Their TypeScript declarations
are selected by the corresponding `types` export condition. Consumers must
import only declared subpaths; internal source paths are not a compatibility
contract.

## Published contents

The npm tarball contains:

- compiled ESM and CommonJS runtime artifacts and source maps;
- generated TypeScript declarations for the root and public JavaScript subpaths;
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
- The framework-independent autosave, converter, envelope-identity,
  revision-evidence, text-position-selector, Markdown, and spreadsheet entrypoints do not
  require React UI, a mounted editor, naruon, contextual-orchestrator, a
  database, provider credentials, or host transport. Their individual
  package-consumer gates additionally prevent framework dependencies from
  leaking into subpaths whose public contracts exclude them.
- The Markdown subpath exposes `markdownToHtml`, `htmlToMarkdown`,
  `normalizeMarkdown`, `markdownToEmailHtml`, `markdownToPlainText`, and
  `htmlToPlainText` plus their option types. It bundles deterministic conversion
  dependencies into its own artifact so importing the subpath does not evaluate
  the root editor graph. Safe-link and strict inline-raster validation live in
  framework-neutral policy modules shared by the editor and serializer rather
  than duplicated in two trust boundaries.
- The Markdown subpath performs no network request and owns no transport,
  credentials, tenant identity, durable persistence, model call, or message-send
  authority. `markdownToEmailHtml` returns deterministic HTML content only; a
  host remains responsible for MIME assembly, recipients, authentication,
  authorization, delivery, retention, and audit.
- The text-position-selector subpath deliberately exposes only the deterministic
  projection constants, error type, selector constructor, and public value
  types. It does not expose the React imperative handle that captures editor
  state or bind a selector to a document revision. Hosts remain responsible for
  annotation identifiers/bodies, source-resource identity, authorization,
  tenancy, persistence, audit, and cross-revision re-anchoring.
- Envelope identity output is routing metadata only. It does not accept an
  unsupported document generation as current semantics and does not move schema
  registry, migration, persistence, rollback, or authorization authority into
  Inkspan.
- Revision and transition evidence prove deterministic local content identity or
  lineage only; they do not manufacture actor, tenant, time, authorization,
  signature, or durable-write provenance.
- The collaboration entrypoint is optional. Standalone consumers do not need to
  import it, and bundlers can retain the separate dependency boundary.
- Importing any JavaScript entrypoint in Node.js must not require a browser DOM.
  Browser-only work begins when a host mounts the editor or calls APIs that
  explicitly consume browser objects such as `File` or `Blob`. The Markdown
  conversion surface remains Node-importable; HTML-to-Markdown uses its bounded
  non-fetching parser fallback when no browser `document` exists.
- CSS and font entrypoints resolve as files and are not executable JavaScript.

## Release verification

Every pull request and main-branch build executes `pnpm verify:package` after the
production library build. The verification chain:

1. runs `npm pack --dry-run --json --ignore-scripts` and inspects the exact npm
   manifest;
2. confirms every `main`, `module`, `types`, and `exports` target exists;
3. confirms required licenses, declarations, styles, and font assets ship;
4. rejects internal source, tests, demos, Office files, coverage output, and
   workflow files from the npm tarball;
5. imports the root, collaboration, converter, autosave, envelope-identity,
   revision-evidence, text-position-selector, Markdown, and spreadsheet surfaces through their
   dedicated packed-consumer checks, including framework-free isolation where
   that is part of the public contract;
6. exercises supported ESM/CommonJS entrypoints and compiles strict TypeScript
   consumers against the published declaration surfaces;
7. resolves public CSS and font subpaths; and
8. fails when a declared public export is absent, mispackaged, or coupled to a
   runtime graph that its public contract excludes.

The text-position-selector package check builds a real npm tarball, consumes the
public subpath through ESM and CommonJS, and compiles a strict TypeScript
consumer. Its emitted JavaScript rejects **any external runtime module import**,
so framework, network, database, credential-provider, and model-SDK clients
cannot enter the selector bundle through module dependencies. A separate check
rejects **ambient network and credential authority** such as `fetch`,
`XMLHttpRequest`, `WebSocket`, `EventSource`, `process.env`, `import.meta.env`,
`Deno.env`, and `Bun.env`. Type-only ProseMirror model/state inputs remain part
of the selector's structural contract and introduce no interactive runtime
authority.

The Markdown package check likewise builds and extracts a real npm tarball,
executes its ESM and CommonJS entrypoints outside the source tree, compiles a
strict TypeScript consumer, and verifies representative safe-link, plain-text,
normalization, and full-document language/direction behavior. Its emitted
JavaScript must contain no external runtime imports, dynamic module loaders,
ambient network/credential access, React/TipTap/Yjs runtime, CWL host coupling,
or model credential names.

A version is release-ready only when this package gate, repository-wide 100%
TypeScript coverage, production builds, the Python Office matrix, applicable
browser/document-fidelity evidence, and required security/review/release gates
pass on the same accepted source generation.

## Compatibility changes

Removing or renaming an export, changing a declaration incompatibly, making an
optional entrypoint pull in a previously absent runtime dependency, or deleting
a documented packaged asset is a breaking change. Additive exports and internal
implementation changes remain subject to semantic-versioning review based on
observable consumer behavior.

## Primary references

- Node.js package entrypoints and conditional exports:
  <https://nodejs.org/api/packages.html>
- Node.js CommonJS module loading:
  <https://nodejs.org/api/modules.html>
- npm `pack`, including dry-run and JSON manifest output:
  <https://docs.npmjs.com/cli/v11/commands/npm-pack>
- npm package publication and the `files` allowlist:
  <https://docs.npmjs.com/cli/v11/commands/npm-publish>
