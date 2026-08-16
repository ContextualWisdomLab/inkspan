/**
 * Host-facing catalog of the repeating editor chrome tokens shipped in
 * `src/styles.css`.
 *
 * The stylesheet remains the runtime presentation authority. This module names
 * those custom properties, maps them to Design Tokens Format Module 2025.10
 * types, and tells a host which property to override on `.cwl-editor`.
 */

export type EditorThemeTokenRole = 'color' | 'dimension' | 'fontFamily';

export type EditorThemeTokenName =
  | 'cwl-fg'
  | 'cwl-muted'
  | 'cwl-border'
  | 'cwl-bg'
  | 'cwl-surface'
  | 'cwl-accent'
  | 'cwl-accent-soft'
  | 'cwl-radius'
  | 'cwl-font';

export interface EditorThemeToken {
  readonly name: EditorThemeTokenName;
  readonly cssCustomProperty: `--${EditorThemeTokenName}`;
  readonly role: EditorThemeTokenRole;
  readonly lightValue: string;
  readonly darkValue?: string;
  readonly forcedColorsValue?: string;
  readonly hostAction: string;
}

export interface DesignTokenFormatNode {
  readonly $type: 'color' | 'dimension' | 'fontFamily';
  readonly $value: string | readonly string[];
  readonly $description: string;
}

export interface DesignTokenFormatGroup {
  readonly cwl: {
    readonly fg: DesignTokenFormatNode;
    readonly muted: DesignTokenFormatNode;
    readonly border: DesignTokenFormatNode;
    readonly bg: DesignTokenFormatNode;
    readonly surface: DesignTokenFormatNode;
    readonly accent: DesignTokenFormatNode;
    readonly 'accent-soft': DesignTokenFormatNode;
    readonly radius: DesignTokenFormatNode;
    readonly font: DesignTokenFormatNode;
  };
}

const ROLE_TO_FORMAT_TYPE = {
  color: 'color',
  dimension: 'dimension',
  fontFamily: 'fontFamily',
} as const satisfies Record<EditorThemeTokenRole, DesignTokenFormatNode['$type']>;

/** Stable fail-closed error for unknown theme-token lookups. */
export class EditorThemeTokenError extends Error {
  readonly code = 'unknown_theme_token';

  constructor() {
    super('Unknown editor theme token.');
    this.name = 'EditorThemeTokenError';
  }
}

function hostAction(cssCustomProperty: `--${EditorThemeTokenName}`): string {
  return `Override ${cssCustomProperty} on .cwl-editor after checking WCAG 2.2 contrast against --cwl-bg. Do not edit Inkspan internals.`;
}

function themeToken(
  name: EditorThemeTokenName,
  role: EditorThemeTokenRole,
  lightValue: string,
  darkValue?: string,
  forcedColorsValue?: string,
): EditorThemeToken {
  const cssCustomProperty = `--${name}` as const;
  return Object.freeze({
    name,
    cssCustomProperty,
    role,
    lightValue,
    darkValue,
    forcedColorsValue,
    hostAction: hostAction(cssCustomProperty),
  });
}

const EDITOR_THEME_TOKENS: readonly EditorThemeToken[] = Object.freeze([
  themeToken('cwl-fg', 'color', '#1f2328', '#e6edf3', '#000000'),
  themeToken('cwl-muted', 'color', '#59636e', '#9198a1', '#444444'),
  themeToken('cwl-border', 'color', '#d1d9e0', '#3d444d', '#999999'),
  themeToken('cwl-bg', 'color', '#ffffff', '#0d1117', '#ffffff'),
  themeToken('cwl-surface', 'color', '#f6f8fa', '#161b22', '#ffffff'),
  themeToken('cwl-accent', 'color', '#0969da', '#4493f8', '#000000'),
  themeToken('cwl-accent-soft', 'color', '#ddf4ff', '#163356', '#ffffff'),
  themeToken('cwl-radius', 'dimension', '8px'),
  themeToken(
    'cwl-font',
    'fontFamily',
    "'Noto Sans', 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  ),
]);

const EDITOR_THEME_TOKEN_BY_NAME: ReadonlyMap<string, EditorThemeToken> = new Map(
  EDITOR_THEME_TOKENS.map((token) => [token.name, token]),
);

const TOKEN_GROUP_KEY: Record<EditorThemeTokenName, keyof DesignTokenFormatGroup['cwl']> = {
  'cwl-fg': 'fg',
  'cwl-muted': 'muted',
  'cwl-border': 'border',
  'cwl-bg': 'bg',
  'cwl-surface': 'surface',
  'cwl-accent': 'accent',
  'cwl-accent-soft': 'accent-soft',
  'cwl-radius': 'radius',
  'cwl-font': 'font',
};

/** Return the frozen catalog of shipped editor theme tokens. */
export function listEditorThemeTokens(): readonly EditorThemeToken[] {
  return EDITOR_THEME_TOKENS;
}

/**
 * Return one shipped theme token by exact catalog name.
 *
 * @throws {EditorThemeTokenError} When the name is not a shipped token.
 */
export function getEditorThemeToken(name: string): EditorThemeToken {
  const token = EDITOR_THEME_TOKEN_BY_NAME.get(name);
  if (!token) {
    throw new EditorThemeTokenError();
  }
  return token;
}

function formatTokenValue(token: EditorThemeToken): string | readonly string[] {
  if (token.role !== 'fontFamily') {
    return token.lightValue;
  }
  return token.lightValue.split(',').map((family) => family.trim().replace(/^['"]|['"]$/gu, ''));
}

function toFormatNode(token: EditorThemeToken): DesignTokenFormatNode {
  return Object.freeze({
    $type: ROLE_TO_FORMAT_TYPE[token.role],
    $value: formatTokenValue(token),
    $description: token.hostAction,
  });
}

/**
 * Return a Design Tokens Format Module 2025.10 group for the shipped chrome.
 *
 * This is an interchange snapshot of Inkspan's CSS custom properties. It is not
 * a claim of complete DTCG conformance, Figma Variables sync, or WCAG contrast
 * certification for host overrides.
 */
export function toDesignTokenFormatGroup(): DesignTokenFormatGroup {
  const cwl = {} as DesignTokenFormatGroup['cwl'];
  for (const token of EDITOR_THEME_TOKENS) {
    Object.defineProperty(cwl, TOKEN_GROUP_KEY[token.name], {
      value: toFormatNode(token),
      enumerable: true,
    });
  }
  return Object.freeze({ cwl: Object.freeze(cwl) });
}
