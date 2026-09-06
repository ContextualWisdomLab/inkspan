# Browser stylesheet provenance

Status: Active PR research and verification repair; not protected-release evidence.

## Failure and smallest repair

Selecting an extracted editor package changed the browser harness's JavaScript
entry but left the actual input editor loading source CSS. Focus and print
fixtures requested the worktree's rebuilt stylesheet. A receipt could therefore
name an archive without proving that its styles were exercised.

At `015e4fd2ab5311c47ece1fb4a98e497354660db0`, both route checks failed in
Chromium, Firefox and WebKit: six failures, no skipped cases. Browser metadata
identified the worktree source/build paths instead of the selected archive's
stylesheet. The extracted JavaScript, autosave and CSS bytes matched the build;
path identity exposed the error even while CSS bytes happened to be equal.

The shared `/dist/cwl-editor.css` route now resolves to the selected package's
stylesheet, or to the local build in source mode. The input harness imports
that same route. Vite's existing absolute-path alias mechanism covers the
callers without a server plugin, a new helper, copied CSS or per-spec routing.
Changing only the input import would leave focus/print consumers uncorrected;
checking archive metadata alone would not observe stylesheet selection.

## Runnable regression and limits

After building, run from the repository root:

```sh
pnpm --dir tests/browser exec playwright test --config playwright.config.ts stylesheet-identity.browser.spec.ts --workers=1
```

Repeat with `INKSPAN_BROWSER_PACKAGE_ENTRY` pointing to the selected extracted
archive's `dist/cwl-editor.js`. The existing release workflow supplies that
entry after verifying and extracting the release archive. The tests check the
actual input editor's loaded CSS identity, shared-route resolution, and served
CSS bytes. Source-mode success alone does not prove package-mode behavior.

The first fixed focused run passed five cases; Firefox's editor case exceeded
its unchanged 20-second deadline during evaluation on a heavily swapping host.
Its snapshot and failure remain retained. The unchanged case then passed alone
with trace. This does not prove the timeout's cause or erase that failed run;
final acceptance still requires fresh complete source and package runs.

No editor styles, commands, API, package exports, browser deadline, retry
allowance, dependency or host authority changed. This is a browser-evidence
repair, not a new physical-device support or performance claim.

## Reference

Vite. (n.d.). *Shared options: resolve.alias*. Retrieved September 6, 2026, from
https://vite.dev/config/shared-options.html#resolve-alias
