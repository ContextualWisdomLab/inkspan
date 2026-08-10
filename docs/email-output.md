# Deterministic email HTML output

Status: Implemented on active PR

Inkspan's `markdownToEmailHtml()` is a deterministic Markdown-to-HTML bridge for email compose/send integrations. It is not a MIME builder, transport client, mailbox API, authentication surface, or persistence service. Hosts such as naruon own transport, recipients, authorization, tenant isolation, delivery policy, durable audit, retention, and downstream mail-client policy.

## Fragment and full-document authority

By default, `markdownToEmailHtml()` returns an HTML body fragment. Fragment mode deliberately does not manufacture document-level `lang` or `dir` metadata because the embedding host owns the surrounding document element and may combine the fragment with other application or mail-template content.

With `fullDocument: true`, Inkspan owns the minimal generated document shell and can therefore preserve document-level metadata on the root `<html>` element:

```ts
markdownToEmailHtml(markdown, {
  fullDocument: true,
  languageTag: 'ko-KR',
  textDirection: 'ltr',
});
```

The full-document contract preserves the existing UTF-8 charset and escaped title behavior. Supplying neither language nor direction preserves the existing root `<html>` shape.

## Language metadata

HTML `lang` identifies the primary language of the generated document. Inkspan treats whitespace-only `languageTag` as absent. A non-blank value is passed through the runtime's ECMA-402 `Intl.getCanonicalLocales()` parser and canonicalizer before emission. Invalid or unsupported locale syntax fails closed with a bounded `RangeError` rather than being copied into markup.

This is intentionally conservative. HTML's normative value space is BCP 47, while ECMA-402 canonical locale identifiers are a runtime-supported canonicalizable subset. Inkspan does not claim that every grandfathered, private-use, or otherwise registry-valid BCP 47 spelling is accepted by every JavaScript runtime. A host requiring a broader language-tag registry must validate and map that registry into an Inkspan-supported canonical tag before requesting full-document generation.

Canonicalized language metadata is escaped before attribute insertion even though accepted ECMA-402 locale identifiers are already syntactically bounded.

## Base direction metadata

`textDirection` accepts only `ltr`, `rtl`, and `auto`, matching HTML's known `dir` values. The TypeScript type exposes that closed literal union, and the runtime validates the same set before building the root attribute so untyped JavaScript, deserialized configuration, or deliberately forged values cannot create arbitrary `dir` markup. An out-of-contract runtime value fails closed with a bounded `RangeError`.

When supplied with `fullDocument: true`, the validated value is emitted as the root `dir` attribute. When omitted, Inkspan does not invent a direction. `dir="auto"` delegates base-direction determination to the consuming HTML user agent under HTML semantics; Inkspan does not inspect document text to guess a direction during deterministic conversion.

## Accessibility and internationalization

WHATWG HTML encourages authors to declare the document language on the root `html` element. WCAG 2.2 Technique H57 describes root `lang` as a sufficient technique for Language of Page because assistive technologies can use document language to select pronunciation and linguistic behavior. The root `dir` attribute supplies document-level base-direction metadata for bidirectional rendering.

These attributes do not prove that translated content is correct, do not replace per-span language changes, and do not create a mail-transport `Content-Language` header. Hosts remain responsible for template-level language changes, MIME headers, localization, recipient policy, and assistive-technology acceptance testing in their complete application.

## Security and privacy boundary

The metadata options never enable raw HTML interpretation, external image fetching, executable links, scripts, model calls, credentials, network access, or persistence. The pre-existing safe Markdown/email serializer remains authoritative for link and image policy.

An invalid non-blank language value or invalid runtime direction fails before a full document is returned. Fragment mode returns the existing body fragment before document metadata is interpreted because the host owns the outer document in that mode.

No database object is introduced. No tenant, actor, recipient, authorization, timestamp, delivery receipt, or durable-write claim is added to generated HTML.

## Compatibility and rollback

This change is additive to `MarkdownToEmailHtmlOptions`. Existing callers that omit `languageTag` and `textDirection` retain the prior fragment/full-document behavior. Fragment callers remain unaffected even if they pass document metadata for a future host wrapper.

Rollback removes the two additive options and returns to a metadata-free generated root. Rollback does not reinterpret already generated HTML or alter host-owned mail messages already persisted or sent.

## Verification

Permanent tests cover:

- Korean `ko-KR` language with explicit `ltr` direction;
- ECMA-402 canonicalization of mixed-case locale input;
- Arabic content with `dir="auto"`;
- fail-closed hostile/invalid language syntax;
- fail-closed invalid runtime direction supplied outside TypeScript's static guarantees;
- whitespace-only language omission;
- explicit `rtl` without a language tag;
- fragment-mode non-wrapping and metadata non-emission; and
- regression preservation of existing safe link/image and full-document title behavior.

Repository-wide exact production statement, branch, function, and line coverage plus TypeScript, package, browser, Office, security, and SAST gates remain required before protected integration.

## Related evidence

- `docs/doctoring/email-document-language-direction.md`
- `src/markdown/emailDocumentMetadata.test.ts`
- `src/markdown/serializer.test.ts`
- `src/markdown/serializer.ts`
