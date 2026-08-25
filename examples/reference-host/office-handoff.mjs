import { markdownToPlainText } from '@contextualwisdomlab/cwl-editor/markdown';

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !/\S/u.test(value)) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }
  return value;
}

function readOfficeHandoffInput(input) {
  try {
    return {
      title: input.title,
      markdown: input.markdown,
    };
  } catch {
    throw new TypeError('Office handoff input is invalid.');
  }
}

/**
 * Create a bounded reference-only DOCX request from editor Markdown.
 *
 * The host deliberately projects Markdown to plain text through Inkspan's
 * React-free public package surface, preserves that projection's deterministic
 * block boundaries as separate DOCX paragraphs, and then constructs the strict
 * Office request. This example does not claim Markdown-to-OOXML round-trip
 * fidelity, perform Office rendering, authorize export, choose a filesystem
 * path, or persist/distribute the resulting artifact; those remain host
 * responsibilities. Host input reflection failures are normalized at this
 * boundary instead of exposing caller-controlled exception values.
 *
 * @param {{ title: string, markdown: string }} input host-owned export input
 * @returns {{ format: 'docx', title: string, blocks: readonly { type: 'paragraph', text: string }[] }}
 */
export function createReferenceDocxRequest(input) {
  const { title, markdown } = readOfficeHandoffInput(input);
  const acceptedTitle = requireNonEmptyString(title, 'title');
  if (typeof markdown !== 'string') {
    throw new TypeError('markdown must be a string.');
  }

  const text = markdownToPlainText(markdown);
  const paragraphs = text.split('\n\n');
  const blocks = Object.freeze(
    paragraphs.map((paragraphText) => Object.freeze({ type: 'paragraph', text: paragraphText })),
  );

  return Object.freeze({
    format: 'docx',
    title: acceptedTitle,
    blocks,
  });
}
