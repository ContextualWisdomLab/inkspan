# DOCX informative inline PNG figures

Status: Implemented on active PR

## Purpose

Inkspan Office's protected DOCX contract historically rendered text-oriented blocks only. The active image slice adds one narrow, deterministic figure boundary for reports that need a self-contained chart, screenshot, logo, or evidence image without giving the renderer network, filesystem-path, model, credential, or tenant authority.

The initial contract supports **informative PNG figures only**. A request carries an exact `data:image/png;base64,...` source, explicit alternative text, and an explicit CSS-pixel width. JPEG, SVG/vector content, remote URLs, local paths, arbitrary RFC 2397 parameters, percent-encoded image payloads, and decorative-object semantics remain outside P0.

## Source and transport boundary

RFC 2397 defines the `data:` URL scheme and permits data to be carried directly in a URL rather than fetched as a separate resource. Inkspan deliberately adopts a much narrower subset than the RFC permits:

- the media type is exactly `image/png`;
- the `;base64` marker is required;
- no extra media-type parameter is accepted;
- the payload must be strict base64;
- the decoded bytes must begin with a valid PNG signature and IHDR prefix; and
- decoded size, width, height, pixel count, alternative text, and requested display width are bounded before successful package publication.

This boundary means the Office renderer never interprets an image field as an HTTP request, path, external OOXML relationship, SVG document, script, macro, or model instruction.

## Deterministic sizing

`python-docx` accepts an in-memory file-like picture source and an explicit width. Inkspan does not use the image file's ambient DPI metadata to select the requested layout width. Instead, `width_px` is converted under the CSS reference-pixel convention used by this contract: 96 CSS pixels per inch, which is exactly 9,525 English Metric Units (EMU) per CSS pixel because OOXML length uses 914,400 EMU per inch.

Only width is supplied to `python-docx`; the library preserves the intrinsic raster aspect ratio when deriving the inline picture height. Tests inspect the generated inline shape and OOXML package rather than relying on request-level arithmetic alone.

## Accessibility authority

A visible figure without an alternative description is not sufficient for this contract. The Open XML word-processing drawing non-visual properties expose a `descr` attribute used as the drawing description/alternative text. Inkspan therefore requires a non-empty bounded `alt_text` value and writes it to `wp:docPr/@descr` for the generated inline picture.

Decorative figures are **rejected in P0** rather than represented by an empty alternative string. Microsoft's Office extension model defines `adec:decorative` as a distinct decorative-object semantic. Supporting that extension is a separate compatibility decision; Inkspan must not claim decorative accessibility by merely omitting or blanking a description.

## Failure and privacy semantics

The renderer fails closed before a successful artifact can be published when an image source is remote, uses an unsupported type, has malformed base64, lacks a valid PNG signature/IHDR boundary, exceeds bytes/dimensions/pixels, lacks meaningful alt text, or requests an invalid width.

Third-party image-parser failures are mapped to a stable bounded public `OfficeDocumentError`. The original data URI, decoded bytes, private parser exception, host path, tenant identity, or document content is not reflected into ordinary diagnostics. `write_office_document()` retains the existing temporary-file/atomic-publication contract, so failed image validation or rendering cannot publish a partial destination artifact.

## Ownership

Inkspan Office owns deterministic validation and OOXML rendering only. Hosts own export authorization, tenant isolation, destination selection, durable storage, retention, signatures/timestamps, distribution, downstream document classification, and any archival/PDF policy. The figure contract does not create OCR, remote fetching, image editing, model-generated alt text, or a general image proxy.

## Verification

The active test line proves the missing image schema as a historical RED and then verifies:

- exact PNG-only JSON Schema shape;
- deterministic repeated DOCX bytes;
- one embedded PNG media part whose bytes equal the committed fixture;
- explicit requested inline dimensions and preserved aspect ratio;
- exact `wp:docPr/@descr` alternative text in generated OOXML;
- failure on undeclared/decorative fields, missing fields, invalid width/alt text, remote/JPEG/SVG/parameterized/percent data URLs, malformed base64, malformed PNG/IHDR, zero/excessive dimensions and pixel count, and truncated raster data;
- redacted errors and no partial output publication; and
- Python 3.11–3.14, 100% shipped production statement/branch coverage, public docstrings, package/wheel verification, CI, Security Scan, and SAST before protected integration.

## References — APA 7th

Masinter, L. (1998). *The "data" URL scheme* (RFC 2397). RFC Editor. https://doi.org/10.17487/RFC2397

Microsoft. (n.d.). *Description*. DocumentFormat.OpenXml.Drawing.Wordprocessing.DocProperties. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.wordprocessing.docproperties.description

Microsoft. (n.d.). *[MS-ODRAWXML]: Decorative*. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/openspecs/office_standards/ms-odrawxml/a7162631-7b00-44b1-a1f3-9b7d653050d8

python-docx. (n.d.). *Inline shapes*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/user/shapes.html

python-docx. (n.d.). *Document objects*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/api/document.html
