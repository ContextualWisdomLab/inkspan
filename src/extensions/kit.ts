/**
 * Shared extension set used by standalone and collaborative Inkspan surfaces.
 * Kept separate from React so hosts may reuse it in headless workflows.
 */
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import type { Extensions } from '@tiptap/react';
import { Base64Image } from './Base64Image.js';
import type {
  ClipboardConfig,
  ClipboardSanitizationError,
} from './SafeClipboard.js';
import { SafeClipboard } from './SafeClipboardExtension.js';
import { SafeLink, isSafeLinkHref } from './SafeLink.js';
import { WritingDiagnostics } from './WritingDiagnostics.js';
import type { ImageConfig } from '../types.js';

/** Options for constructing the shared Inkspan extension collection. */
export interface BuildExtensionsOptions {
  /** Static or lazily resolved visual empty-editor guidance. */
  placeholder?: string | (() => string);
  image?: ImageConfig;
  /** Bounded rich-HTML paste policy shared by all editor surfaces. */
  clipboard?: ClipboardConfig;
  /**
   * Forwarded to {@link Base64Image} so paste/drop failures reach the host.
   */
  onImageError?: (error: Error) => void;
  /** Redacted rich-clipboard rejection observer. */
  onClipboardError?: (error: ClipboardSanitizationError) => void;
  /** Disable StarterKit history when a CRDT owns undo/redo semantics. */
  disableHistory?: boolean;
  /** Additional host or product extensions appended after the shared kit. */
  additionalExtensions?: Extensions;
}

/** Build the full extension list for an Inkspan editor surface. */
export function buildExtensions(
  options: BuildExtensionsOptions = {},
): Extensions {
  const image = options.image ?? {};
  const historyConfiguration = options.disableHistory
    ? { history: false as const }
    : {};

  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: {
        HTMLAttributes: { class: 'cwl-code-block' },
      },
      ...historyConfiguration,
    }),
    SafeLink.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      isAllowedUri: (href) => isSafeLinkHref(href),
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    }),
    SafeClipboard.configure({
      config: options.clipboard,
      onError: options.onClipboardError,
    }),
    WritingDiagnostics,
    Placeholder.configure({
      placeholder: options.placeholder ?? 'Start writing…',
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Base64Image.configure({
      maxSizeBytes: image.maxSizeBytes ?? 10 * 1024 * 1024,
      maxDimension: image.maxDimension ?? 1600,
      quality: image.quality ?? 0.85,
      onError: options.onImageError,
    }),
    ...(options.additionalExtensions ?? []),
  ];
}
