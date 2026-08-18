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
  readonly meetsTextContrast: boolean;
  readonly meetsNonTextContrast: boolean;
  readonly hostAction: string;
}

/** WCAG 2.2 Success Criterion 1.4.3 minimum contrast for regular text. */
export const WCAG_TEXT_CONTRAST_RATIO = 4.5;

/** WCAG 2.2 Success Criterion 1.4.11 minimum contrast for UI components. */
export const WCAG_NON_TEXT_CONTRAST_RATIO = 3;

/** DTCG 2025.10 sRGB color value used by the interchange snapshot. */
export interface DesignTokenFormatColorValue {
  readonly colorSpace: 'srgb';
  readonly components: readonly [number, number, number];
  readonly hex: string;
}

/** DTCG 2025.10 dimension value used by the interchange snapshot. */
export interface DesignTokenFormatDimensionValue {
  readonly value: number;
  readonly unit: 'px' | 'rem';
}

export type DesignTokenFormatValue =
  | DesignTokenFormatColorValue
  | DesignTokenFormatDimensionValue
  | string
  | readonly string[];

export interface DesignTokenFormatNode {
  readonly $type: 'color' | 'dimension' | 'fontFamily';
  readonly $value: DesignTokenFormatValue;
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

function hostAction(
  name: EditorThemeTokenName,
  cssCustomProperty: `--${EditorThemeTokenName}`,
): string {
  const actions = {
    'cwl-accent': `Override ${cssCustomProperty} on .cwl-editor after checking WCAG 2.2 text contrast against --cwl-accent-soft (active toolbar) and --cwl-bg (links). Do not edit Inkspan internals.`,
    'cwl-accent-soft': `Override ${cssCustomProperty} on .cwl-editor after checking WCAG 2.2 text contrast against --cwl-accent on active toolbar buttons. Do not edit Inkspan internals.`,
    'cwl-fg': `Override ${cssCustomProperty} on .cwl-editor after checking WCAG 2.2 text contrast against --cwl-bg. Do not edit Inkspan internals.`,
    'cwl-muted': `Override ${cssCustomProperty} on .cwl-editor after checking WCAG 2.2 text contrast against --cwl-bg. Do not edit Inkspan internals.`,
    'cwl-border': `Override ${cssCustomProperty} on .cwl-editor after checking WCAG 2.2 non-text contrast against adjacent chrome. Do not edit Inkspan internals.`,
    'cwl-bg': `Override ${cssCustomProperty} on .cwl-editor after checking WCAG 2.2 text contrast of --cwl-fg and --cwl-muted against this background. Do not edit Inkspan internals.`,
    'cwl-surface': `Override ${cssCustomProperty} on .cwl-editor after checking WCAG 2.2 text contrast of --cwl-fg and --cwl-muted against this background. Do not edit Inkspan internals.`,
    'cwl-radius': `Override ${cssCustomProperty} on .cwl-editor. Do not edit Inkspan internals.`,
    'cwl-font': `Override ${cssCustomProperty} on .cwl-editor. Do not edit Inkspan internals.`,
  } as const satisfies Record<EditorThemeTokenName, string>;
  return actions[name];
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
    hostAction: hostAction(name, cssCustomProperty),
  });
}

const EDITOR_THEME_TOKENS: readonly EditorThemeToken[] = Object.freeze([
  themeToken('cwl-fg', 'color', '#1f2328', '#e6edf3', '#000000'),
  themeToken('cwl-muted', 'color', '#59636e', '#9198a1', '#444444'),
  themeToken('cwl-border', 'color', '#d1d9e0', '#3d444d', '#999999'),
  themeToken('cwl-bg', 'color', '#ffffff', '#0d1117', '#ffffff'),
  themeToken('cwl-surface', 'color', '#f6f8fa', '#161b22', '#ffffff'),
  themeToken('cwl-accent', 'color', '#0969da', '#58a6ff', '#000000'),
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
 * Return the WCAG 2.2 contrast ratio for two shipped catalog color tokens.
 *
 * This helper evaluates Inkspan's catalog values for the requested scheme; it
 * cannot observe host CSS overrides. After overriding a pair on `.cwl-editor`,
 * pass the resolved `#rrggbb` values to `contrastRatioFromHex()` instead. The
 * ratio is not a host WCAG certification.
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
  const ratio = contrastRatioFromHex(
    colorValueForScheme(foreground, scheme),
    colorValueForScheme(background, scheme),
  );
  const meetsTextContrast = ratio >= WCAG_TEXT_CONTRAST_RATIO;
  const meetsNonTextContrast = ratio >= WCAG_NON_TEXT_CONTRAST_RATIO;
  const pairNames = `--${foreground.name} and --${background.name}`;
  const resolvedOverrideAction =
    'For host overrides, pass the resolved #rrggbb pair to contrastRatioFromHex(actualForegroundHex, actualBackgroundHex) before shipping.';
  return Object.freeze({
    foreground: foreground.name,
    background: background.name,
    scheme,
    ratio,
    meetsTextContrast,
    meetsNonTextContrast,
    hostAction: meetsTextContrast
      ? `Catalog ${scheme} contrast is ${ratio.toFixed(2)}:1. ${resolvedOverrideAction} Override ${pairNames} only on .cwl-editor; do not edit Inkspan internals.`
      : `Catalog ${scheme} text contrast is below 4.5:1. Override ${pairNames} on .cwl-editor and ${resolvedOverrideAction} Do not edit Inkspan internals.`,
  });
}

function formatColorTokenValue(value: string): DesignTokenFormatColorValue {
  const integer = Number.parseInt(value.slice(1), 16);
  return Object.freeze({
    colorSpace: 'srgb',
    components: Object.freeze([
      ((integer >> 16) & 0xff) / 255,
      ((integer >> 8) & 0xff) / 255,
      (integer & 0xff) / 255,
    ] as const),
    hex: value,
  });
}

function formatDimensionTokenValue(value: string): DesignTokenFormatDimensionValue {
  const [, numericValue, unit] = /^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem)$/u.exec(value)!;
  return Object.freeze({
    value: Number.parseFloat(numericValue),
    unit: unit as DesignTokenFormatDimensionValue['unit'],
  });
}

function formatTokenValue(token: EditorThemeToken): DesignTokenFormatValue {
  switch (token.role) {
    case 'color':
      return formatColorTokenValue(token.lightValue);
    case 'dimension':
      return formatDimensionTokenValue(token.lightValue);
    case 'fontFamily':
      return token.lightValue
        .split(',')
        .map((family) => family.trim().replace(/^['"]|['"]$/gu, ''));
  }
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
 * The light/default snapshot emits DTCG-native color, dimension, and font-family
 * value shapes. Dark and print CSS schemes remain available from the token
 * catalog and stylesheet authority. This is not Figma Variables sync or a WCAG
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
