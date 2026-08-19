import { expect } from 'vitest';
import {
  DocxImportError,
  type DocxImportErrorCode,
} from '../src/docx/index.js';

export async function expectDocxCode(
  operation: Promise<unknown>,
  code: DocxImportErrorCode,
): Promise<void> {
  try {
    await operation;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DocxImportError);
    expect(error).toMatchObject({ name: 'DocxImportError', code });
    expect((error as Error).message).not.toContain('Hello');
  }
}

export function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
