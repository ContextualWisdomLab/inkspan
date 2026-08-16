/**
 * Host-facing catalog of the repeating editor chrome tokens shipped in
 * `src/styles.css`.
 *
 * The stylesheet remains the runtime presentation authority. This module names
 * those custom properties, maps them to Design Tokens Format Module 2025.10
 * types, and tells a host which property to override on `.cwl-editor`.
 */

export type EditorThemeTokenRole = 'color' | 'dimension' | 'fontFamily';

export type EditorThemeTokenScheme = 'light' | 'dark' | 'print';

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
  readonly printValue?: string;
  readonly hostAction: string;
}

export interface EditorThemeTokenContrast {
  readonly foreground: EditorThemeTokenName;
  readonly background: EditorThemeTokenName;
  readonly scheme: EditorThemeTokenScheme;
  readonly ratio: number;
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

/** Stable fail-closed error when contrast is requested for a non-color token. */
export class EditorThemeTokenContrastError extends Error {
  readonly code = 'non_color_theme_token';

  constructor() {
    super('Theme token contrast requires color tokens.');
    this.name = 'EditorThemeTokenContrastError';
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
  printValue?: string,
): EditorThemeToken {
  const cssCustomProperty = `--${name}` as const;
  return Object.freeze({
    name,
    cssCustomProperty,
    role,
    lightValue,
    darkValue,
    printValue,
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

function srgbChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/iu.exec(hex);
  if (!match) {
    throw new EditorThemeTokenContrastError();
  }
  const integer = Number.parseInt(match[1], 16);
  return (
    0.2126 * srgbChannel((integer >> 16) & 0xff) +
    0.7152 * srgbChannel((integer >> 8) & 0xff) +
    0.0722 * srgbChannel(integer & 0xff)
  );
}

/**
 * Return the WCAG 2.2 contrast ratio for two `#rrggbb` colors.
 *
 * Use this after a host override so the new hex pair can be checked without
 * editing Inkspan internals. The ratio is not a host WCAG certification.
 *
 * @throws {EditorThemeTokenContrastError} When either value is not `#rrggbb`.
 */
export function contrastRatioFromHex(left: string, right: string): number {
  const first = relativeLuminance(left);
  const second = relativeLuminance(right);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorValueForScheme(
  token: EditorThemeToken,
  scheme: EditorThemeTokenScheme,
): string {
  switch (scheme) {
    case 'light':
      return token.lightValue;
    case 'dark':
      return token.darkValue!;
    case 'print':
      return token.printValue!;
    default: {
      const exhaustive: never = scheme;
      void exhaustive;
      throw new EditorThemeTokenContrastError();
    }
  }
}

/**
 * Return the WCAG 2.2 contrast ratio for two shipped color tokens.
 *
 * Use this after a host override to decide whether `--cwl-fg` still meets
 * 4.5:1 against `--cwl-bg`. The ratio is not a host WCAG certification.
 *
 * @throws {EditorThemeTokenError} When either name is not a shipped token.
 * @throws {EditorThemeTokenContrastError} When either token is not a color.
 */
export function getEditorThemeTokenContrast(
  foregroundName: string,
  backgroundName: string,
  scheme: EditorThemeTokenScheme = 'light',
): EditorThemeTokenContrast {
  const foreground = getEditorThemeToken(foregroundName);
  const background = getEditorThemeToken(backgroundName);
  if (foreground.role !== 'color' || background.role !== 'color') {
    throw new EditorThemeTokenContrastError();
  }
  return Object.freeze({
    foreground: foreground.name,
    background: background.name,
    scheme,
    ratio: contrastRatioFromHex(
      colorValueForScheme(foreground, scheme),
      colorValueForScheme(background, scheme),
    ),
    hostAction: `Override --${foreground.name} and --${background.name} on .cwl-editor after checking WCAG 2.2 contrast. Do not edit Inkspan internals.`,
  });
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
