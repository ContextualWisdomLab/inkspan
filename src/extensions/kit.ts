/**
 * Shared extension set used by both editor modes. Kept separate from the React
 * component so it can be reused headlessly (e.g. server-side HTML generation
 * via `@tiptap/html`).
 */
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import type { Extensions } from '@tiptap/react';
import { Base64Image } from './Base64Image.js';
import type { ImageConfig } from '../types.js';

export interface BuildExtensionsOptions {
  placeholder?: string;
  image?: ImageConfig;
  /**
   * Forwarded to {@link Base64Image} `onError` so paste/drop size-guard and
   * decode failures reach the host (same contract as toolbar upload via
   * `CwlEditorProps.onImageError`).
   */
  onImageError?: (error: Error) => void;
}

/** Build the full extension list for the editor. */
export function buildExtensions(
  options: BuildExtensionsOptions = {},
): Extensions {
  const image = options.image ?? {};
  return [
    StarterKit.configure({
      // Commercial UX: sensible history, code blocks, headings 1-6.
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: {
        HTMLAttributes: { class: 'cwl-code-block' },
      },
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    }),
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
  ];
}
