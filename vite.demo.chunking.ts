const NODE_MODULES = '/node_modules/';

function hasPackage(moduleId: string, packageName: string): boolean {
  return moduleId.includes(`${NODE_MODULES}${packageName}/`);
}

/**
 * Assign large demo-only dependency families to stable Rollup vendor chunks.
 * Product/library entry points are unchanged; this only keeps the standalone
 * buyer demo from regressing into one oversized JavaScript payload.
 */
export function demoVendorChunk(id: string): string | undefined {
  const moduleId = id.replace(/\\/g, '/');

  if (!moduleId.includes(NODE_MODULES)) {
    return undefined;
  }

  if (
    hasPackage(moduleId, 'react') ||
    hasPackage(moduleId, 'react-dom') ||
    hasPackage(moduleId, 'scheduler')
  ) {
    return 'react-vendor';
  }

  if (
    hasPackage(moduleId, '@tiptap/pm') ||
    moduleId.includes(`${NODE_MODULES}prosemirror-`)
  ) {
    return 'prosemirror-vendor';
  }

  if (moduleId.includes(`${NODE_MODULES}@tiptap/`)) {
    return 'tiptap-vendor';
  }

  if (
    hasPackage(moduleId, 'marked') ||
    hasPackage(moduleId, 'turndown') ||
    hasPackage(moduleId, 'turndown-plugin-gfm')
  ) {
    return 'serialization-vendor';
  }

  if (
    hasPackage(moduleId, 'yjs') ||
    hasPackage(moduleId, 'y-prosemirror')
  ) {
    return 'collaboration-vendor';
  }

  return 'vendor';
}
