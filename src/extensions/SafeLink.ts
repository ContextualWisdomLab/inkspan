/**
 * SafeLink — a TipTap link extension with one strict URI policy across editor
 * input, commands, paste/autolink, direct ProseMirror transactions,
 * collaboration updates, and HTML serialization.
 *
 * Inkspan permits HTTPS/HTTP, mailto, tel, document-relative, query-only, and
 * fragment links. Protocol-relative URLs, executable/local schemes, embedded
 * credentials, backslashes, literal whitespace/control characters,
 * bidirectional formatting controls, malformed absolute URLs, and unknown
 * schemes are rejected.
 */
import Link from '@tiptap/extension-link';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { isSafeLinkHref } from '../policy/safeLinkPolicy.js';

export {
  SafeLinkHrefError,
  isSafeLinkHref,
  validateSafeLinkHref,
} from '../policy/safeLinkPolicy.js';

/** ProseMirror plugin key for the direct-transaction safety boundary. */
export const safeLinkPluginKey = new PluginKey('cwlSafeLink');

/** Return true when every link mark in a document has a safe target. */
function documentHasOnlySafeLinks(documentNode: ProseMirrorNode): boolean {
  let safe = true;
  documentNode.descendants((node) => {
    if (!safe) return false;
    for (const mark of node.marks) {
      if (mark.type.name !== 'link') continue;
      if (!isSafeLinkHref(mark.attrs.href)) {
        safe = false;
        return false;
      }
    }
    return true;
  });
  return safe;
}

/**
 * Strict Link extension. Configure `isAllowedUri` when adding it to an editor;
 * the additional transaction filter closes command-bypass and CRDT ingress.
 */
export const SafeLink = Link.extend({
  addProseMirrorPlugins() {
    /* v8 ignore next -- SafeLink always extends TipTap's Link extension. */
    const parentPlugins = this.parent?.() ?? [];
    return [
      ...parentPlugins,
      new Plugin({
        key: safeLinkPluginKey,
        filterTransaction: (transaction) =>
          !transaction.docChanged || documentHasOnlySafeLinks(transaction.doc),
      }),
    ];
  },
});

export default SafeLink;
