"""Contract tests for bounded external hyperlinks in DOCX rich paragraphs."""

from __future__ import annotations

from io import BytesIO
from types import MappingProxyType
from xml.etree import ElementTree
from zipfile import ZipFile

import pytest

from inkspan_office import OfficeDocumentError, load_schema, render_office_document

_WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
_DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_HYPERLINK_REL = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
)


def _rich_link_payload(href: object) -> dict[str, object]:
    """Build one minimal DOCX request containing a linked rich-text run."""

    return {
        "format": "docx",
        "blocks": [
            {
                "type": "rich_paragraph",
                "runs": [
                    {
                        "text": "Inkspan documentation",
                        "bold": True,
                        "italic": True,
                        "underline": True,
                        "href": href,
                    }
                ],
            }
        ],
    }


def _relationship_parts(data: bytes) -> tuple[ElementTree.Element, ElementTree.Element]:
    """Return parsed Word document and relationship XML roots from rendered bytes."""

    with ZipFile(BytesIO(data)) as package:
        document_root = ElementTree.fromstring(package.read("word/document.xml"))
        relationships_root = ElementTree.fromstring(
            package.read("word/_rels/document.xml.rels")
        )
    return document_root, relationships_root


def test_docx_rich_run_schema_exposes_bounded_hyperlink_target() -> None:
    """The public schema must expose one bounded string target for rich runs."""

    schema = load_schema()
    href_schema = schema["$defs"]["richTextRun"]["properties"]["href"]

    assert href_schema["type"] == "string"
    assert href_schema["minLength"] == 1
    assert href_schema["maxLength"] == 4096
    assert "HTTP" in href_schema["description"]


@pytest.mark.parametrize(
    "href",
    [
        "https://example.com/inkspan",
        "http://example.com/reference?source=inkspan#section",
    ],
)
def test_docx_rich_run_renders_external_hyperlink_relationship(href: str) -> None:
    """Accepted HTTP(S) runs must bind visible formatted text to exact targets."""

    rendered = render_office_document(_rich_link_payload(href))
    document_root, relationships_root = _relationship_parts(rendered.data)

    hyperlink = document_root.find(f".//{{{_WORD_NS}}}hyperlink")
    assert hyperlink is not None
    relationship_id = hyperlink.attrib[f"{{{_DOC_REL_NS}}}id"]
    assert "".join(hyperlink.itertext()) == "Inkspan documentation"
    assert hyperlink.find(f".//{{{_WORD_NS}}}b") is not None
    assert hyperlink.find(f".//{{{_WORD_NS}}}i") is not None
    assert hyperlink.find(f".//{{{_WORD_NS}}}u") is not None

    relationship = next(
        relation
        for relation in relationships_root.findall(f"{{{_REL_NS}}}Relationship")
        if relation.attrib.get("Id") == relationship_id
    )
    assert relationship.attrib["Type"] == _HYPERLINK_REL
    assert relationship.attrib["Target"] == href
    assert relationship.attrib["TargetMode"] == "External"


@pytest.mark.parametrize(
    "href",
    [
        None,
        7,
        {},
        MappingProxyType({"url": "https://example.com"}),
        "",
        "https://example.com/" + "a" * 4096,
        "javascript:alert(1)",
        "data:text/plain,hello",
        "mailto:security@example.com",
        "tel:+15551234567",
        "//example.com/path",
        r"\\server\share",
        "relative/path",
        "https:/missing-authority",
        "https://:443/path",
        "https://[::1",
        "https://example.com:bad-port/path",
        "https://example.com/has space",
        "https://example.com/control\npath",
        "https://user:secret@example.com/private",
        "https://ｅxample.com/path",
        "https://example.com/資料",
    ],
)
def test_docx_rich_run_rejects_forbidden_hyperlink_targets_without_reflection(
    href: object,
) -> None:
    """Unsafe, ambiguous, local, credential-bearing, or non-ASCII targets fail closed."""

    with pytest.raises(OfficeDocumentError) as captured:
        render_office_document(_rich_link_payload(href))

    message = str(captured.value)
    assert "blocks[0].runs[0].href" in message
    if isinstance(href, str) and href:
        assert href not in message


def test_docx_rich_run_hyperlink_rendering_is_deterministic() -> None:
    """The same accepted hyperlink payload must canonicalize to identical DOCX bytes."""

    payload = _rich_link_payload("https://example.com/inkspan")

    assert render_office_document(payload).data == render_office_document(payload).data
