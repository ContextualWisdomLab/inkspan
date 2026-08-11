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

/** Fail closed without reflecting caller-controlled image configuration. */
function invalidImageConfiguration(): never {
  throw new RangeError('Image configuration is invalid.');
}

/** Reject unknown own keys without evaluating any configuration property. */
function validateImageConfigurationKeys(image: object): void {
  let keys: PropertyKey[];
  try {
    keys = Reflect.ownKeys(image);
  } catch {
    invalidImageConfiguration();
  }

  for (const key of keys) {
    if (
      key !== 'maxSizeBytes' &&
      key !== 'maxDimension' &&
      key !== 'quality'
    ) {
      invalidImageConfiguration();
    }
  }
}

/** Read one own enumerable data property without invoking accessors. */
function readImageConfigurationProperty(
  image: object,
  key: keyof ImageConfig,
): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(image, key);
  } catch {
    invalidImageConfiguration();
  }

  if (descriptor === undefined) {
    return undefined;
  }
  if (!descriptor.enumerable || !('value' in descriptor)) {
    invalidImageConfiguration();
  }
  return descriptor.value;
}

/** Reject malformed runtime image configuration containers before property reads. */
function resolveRuntimeImageConfiguration(value: unknown): ImageConfig {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalidImageConfiguration();
  }

  validateImageConfigurationKeys(value);
  const maxSizeBytes = readImageConfigurationProperty(value, 'maxSizeBytes');
  const maxDimension = readImageConfigurationProperty(value, 'maxDimension');
  const quality = readImageConfigurationProperty(value, 'quality');

  validateImageNonNegativeSafeInteger('maxSizeBytes', maxSizeBytes);
  validateImageNonNegativeSafeInteger('maxDimension', maxDimension);
  validateImageQuality(quality);

  return {
    maxSizeBytes: maxSizeBytes as number | undefined,
    maxDimension: maxDimension as number | undefined,
    quality: quality as number | undefined,
  };
}

/** Reject invalid runtime size/dimension configuration before extension setup. */
function validateImageNonNegativeSafeInteger(
  key: 'maxSizeBytes' | 'maxDimension',
  value: unknown,
): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < 0)) {
    throw new RangeError(`Image ${key} configuration is invalid.`);
  }
}

/** Reject non-finite or out-of-range runtime image quality configuration. */
function validateImageQuality(value: unknown): void {
  if (
    value !== undefined &&
    (!Number.isFinite(value) || (value as number) < 0 || (value as number) > 1)
  ) {
    throw new RangeError('Image quality configuration is invalid.');
  }
}

/** Build the full extension list for an Inkspan editor surface. */
export function buildExtensions(
  options: BuildExtensionsOptions = {},
): Extensions {
  const image = resolveRuntimeImageConfiguration(options.image);
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
