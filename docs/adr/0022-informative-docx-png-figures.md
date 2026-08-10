# ADR 0022: Informative inline PNG figures in deterministic DOCX output

Status: Accepted

## Context

Inkspan's protected authoring surface can carry self-contained inline raster images, while Inkspan Office historically rendered text-oriented DOCX blocks only. That mismatch forced hosts to drop charts, screenshots, logos, and evidence figures or maintain a second Office-specific rendering path.

PR #121 added a deliberately narrow image block to protected `main`. The architectural question is not merely whether Word can embed a picture; it is which source, resource, accessibility, sizing, privacy, and export authorities belong inside Inkspan Office versus the embedding host.

RFC 2397 defines `data:` URLs broadly. `python-docx` can add pictures from file-like objects. Microsoft Open XML documentation defines the Word drawing description (`descr`) as alternative-description metadata, while modern Office decorative semantics use a separate `adec:decorative` extension. A permissive image contract would therefore introduce unnecessary remote/path authority, ambiguous accessibility claims, and unbounded resource risk.

## Alternatives considered

### Allow arbitrary URLs and let the renderer fetch them

Rejected. Network resolution, SSRF policy, credentials, tenant egress, timeouts, cache/provenance, and remote-content availability belong to the host and would make the renderer nondeterministic.

### Allow caller-controlled filesystem paths

Rejected. A document renderer must not acquire ambient host-filesystem read authority merely because a request contains an image reference.

### Accept many raster/vector formats immediately

Rejected for P0. SVG/vector content and additional decoders materially expand active-content, parser, compatibility, and accessibility surfaces. JPEG support is technically feasible but is not required to establish the first self-contained figure contract.

### Treat an empty alternative string as a decorative figure

Rejected. Office decorative objects use a distinct accessibility semantic. Blank text would conflate missing accessibility data with an intentional decorative declaration.

### Accept informative inline PNG figures only

Selected. It closes the buyer-visible fidelity gap while preserving deterministic, network-free, bounded rendering and honest accessibility semantics.

## Decision

Protected Inkspan Office accepts one DOCX block form for informative inline PNG figures:

```json
{
  "type": "image",
  "source": "data:image/png;base64,...",
  "alt_text": "Quarterly retention chart",
  "width_px": 960
}
```

The protected contract is:

1. `source` is exactly `data:image/png;base64,...`; HTTP(S), file, blob, JPEG, SVG/vector, additional media-type parameters, percent-encoded payloads, caller paths, and external OOXML relationships are unsupported;
2. base64 is strict and decoded bytes must pass the PNG signature/IHDR boundary before the image parser is invoked;
3. encoded and decoded size, width, height, pixel count, alternative-text length, and requested display width are bounded before successful artifact publication;
4. `width_px` is required, ranges from 1 through 2,400, and is converted deterministically at 9,525 OOXML English Metric Units per CSS pixel; the intrinsic raster aspect ratio determines height;
5. non-empty `alt_text` is required, bounded to 1,000 characters, and emitted as the Word drawing `wp:docPr/@descr` description;
6. decorative-image semantics are unsupported rather than approximated;
7. third-party parser exceptions are mapped to bounded public errors without reflecting the data URI, decoded bytes, host paths, or private parser exceptions; and
8. failed validation/rendering cannot publish a partial destination through Inkspan Office's atomic publication boundary.

Inkspan Office owns deterministic request validation and OOXML rendering only. Hosts own export authorization, tenant isolation, destination/storage, retention, signatures/timestamps, distribution, classification, and any durable PDF/archival policy.

## Consequences

- Word reports can preserve a bounded informative chart/screenshot/logo/figure without a second renderer.
- The image request remains self-contained and deterministic; no egress or ambient file read is introduced.
- PNG-only P0 is intentionally narrower than the interactive editor image policy and must not be marketed as universal Office image fidelity.
- Accessibility is explicit: informative figures require a description, while decorative support waits for a proper Office-compatible contract.
- Future JPEG, decorative, PPTX/XLSX image, remote-asset, or richer layout support is additive work, not an undocumented extension of this decision.

## Failure and recovery

Malformed base64, unsupported source forms, malformed/truncated PNGs, zero or excessive dimensions, excessive pixels/bytes, invalid display width, missing/empty/oversized alternative text, undeclared fields, or parser rejection fail closed before a successful artifact is returned or published.

Recovery is to correct the structured request. Inkspan does not fetch, repair, transcode, OCR, or ask a model to infer missing image metadata automatically.

If a future parser/library regression causes a previously valid protected fixture to fail, the Office release lane remains blocked until the exact source head either restores the contract or explicitly supersedes this ADR.

## Security and privacy impact

The decision removes remote-fetch and caller-path attack surfaces from this image boundary. Resource limits constrain memory/decompression pressure before successful publication, and diagnostics remain source-redacted.

The embedded image is still document content. Inkspan does not make it public, log it generically, infer tenant/actor identity, or authorize its export. Hosts remain responsible for document authorization, data classification, downstream storage, encryption, retention, and recipient/destination policy.

## Compatibility and migration

The change is additive to the DOCX block union. Existing text-oriented requests remain valid and unchanged.

Consumers that want figures can add the new image block without changing the output format or transport. Unsupported historical image representations do not gain implicit meaning. Future additions must use explicit schema evolution and preserve old semantics or document a versioned migration.

## Verification and acceptance evidence

The decision is Accepted because protected `main` contains PR #121 and its exact-head evidence:

- a historical RED proving the protected schema previously had no `type=image` branch;
- deterministic repeated DOCX output;
- generated package inspection proving one exact embedded PNG media part;
- explicit inline dimensions and preserved aspect ratio;
- exact `wp:docPr/@descr` alternative-description metadata;
- rejection tests for remote/file/JPEG/SVG/parameterized/percent data URLs, malformed base64/PNG/IHDR, invalid alt text/width, resource bounds, and undeclared/decorative fields;
- redacted errors and no partial publication on image failure;
- Python 3.11–3.14 Office gates with 100% shipped production statement/branch coverage and shipped-symbol docstring coverage; and
- exact-head repository CI, Security Scan, and SAST success before protected merge.

Live host export authorization and downstream Office/assistive-technology behavior remain separate integration evidence and are not inferred from source tests alone.

## Rollback or supersession

A rollback that removes the image block is a public capability regression and requires release notes plus compatibility guidance. Published documents remain ordinary DOCX files and do not require an Inkspan runtime to read their embedded PNGs.

JPEG support, true decorative-object metadata, richer inline run/layout models, PPTX/XLSX pictures, or a durable PDF/export service require either additive bounded contracts or a superseding ADR when authority materially changes. Remote-image fetching or host-filesystem paths may not be introduced as a convenience-only extension to this ADR.

## References — APA 7th

Masinter, L. (1998). *The "data" URL scheme* (RFC 2397). RFC Editor. https://doi.org/10.17487/RFC2397

Microsoft. (n.d.). *Description*. DocumentFormat.OpenXml.Drawing.Wordprocessing.DocProperties. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.wordprocessing.docproperties.description

Microsoft. (n.d.). *[MS-ODRAWXML]: Decorative*. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/openspecs/office_standards/ms-odrawxml/a7162631-7b00-44b1-a1f3-9b7d653050d8

python-docx. (n.d.). *Inline shapes*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/user/shapes.html

python-docx. (n.d.). *Document objects*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/api/document.html
