import type { HangulDocumentEngine, HangulEngineDocument } from './index.js';

export interface HangulDocumentConstructor {
  new (source: Uint8Array): HangulEngineDocument;
  createEmpty(): HangulEngineDocument;
}

export interface HangulModuleLike {
  HwpDocument: HangulDocumentConstructor;
}

/** Adapt an initialized parser module to the Inkspan engine boundary. */
export function createHangulModuleEngine(module: HangulModuleLike): HangulDocumentEngine {
  return {
    id: 'hangul-module',
    open: (source) => new module.HwpDocument(source),
    create: () => module.HwpDocument.createEmpty(),
  };
}
