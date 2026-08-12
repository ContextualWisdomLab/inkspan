import type { CwlEditorDocumentRevision } from './documentEnvelopeRevision.js';
import {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  type CwlEditorTextPositionSelector,
  type CwlEditorTextProjectionIdentity,
} from './textPositionSelectorEvidence.js';

/** Host-controlled presentation priority for one advisory writing diagnostic. */
export type CwlWritingDiagnosticPriority =
  | 'advisory'
  | 'important'
  | 'critical';

/** Bounded provenance identifiers supplied by the host that produced a diagnostic. */
export interface CwlWritingDiagnosticProvenance {
  /** Opaque host workflow identity. */
  readonly workflowId: string;
  /** Opaque host workflow version. */
  readonly workflowVersion: string;
  /** Opaque version of the host's judge/evaluation policy. */
  readonly judgePolicyVersion: string;
  /** Optional opaque host orchestration-mode identity. */
  readonly orchestrationMode?: string;
}

/**
 * Provider-neutral advisory writing diagnostic supplied by a host application.
 *
 * Inkspan treats every semantic field as untrusted proposal data. The editor
 * validates only structure, bounds, revision/projection identity, selectors,
 * and lifecycle state; it does not infer grammar, spelling, tone, clarity,
 * pragmatics, technical quality, or actionability.
 */
export interface CwlWritingDiagnostic {
  /** Opaque host identifier unique within one submitted diagnostic set. */
  readonly diagnosticId: string;
  /** Exact strong revision for the immutable document snapshot judged by the host. */
  readonly documentRevision: CwlEditorDocumentRevision;
  /** Exact Inkspan text-projection identity used by `selector`. */
  readonly textProjection: CwlEditorTextProjectionIdentity;
  /** W3C text-position selector over the declared projection. */
  readonly selector: CwlEditorTextPositionSelector;
  /** Opaque host category code; Inkspan does not derive semantics from it. */
  readonly categoryCode: string;
  /** Host-selected presentation priority. */
  readonly priority: CwlWritingDiagnosticPriority;
  /** Human-readable host-supplied title rendered as plain text. */
  readonly title: string;
  /** Human-readable host-supplied explanation rendered as plain text. */
  readonly explanation: string;
  /** Optional plain-text replacement proposal. */
  readonly suggestedReplacement?: string;
  /** Optional host confidence on the closed interval `[0, 1]`. */
  readonly confidence?: number;
  /** Opaque, privacy-minimized host provenance identifiers. */
  readonly provenance: Readonly<CwlWritingDiagnosticProvenance>;
}

/** Optional stricter local resource ceilings for diagnostic validation. */
export interface WritingDiagnosticLimits {
  /** Maximum number of diagnostics accepted for one immutable editor snapshot. */
  readonly maxDiagnostics?: number;
  /** Maximum UTF-16 code-unit length of `diagnosticId`. */
  readonly maxDiagnosticIdCodeUnits?: number;
  /** Maximum UTF-16 code-unit length of `categoryCode`. */
  readonly maxCategoryCodeUnits?: number;
  /** Maximum UTF-16 code-unit length of each provenance identifier. */
  readonly maxProvenanceCodeUnits?: number;
  /** Maximum UTF-16 code-unit length of `title`. */
  readonly maxTitleCodeUnits?: number;
  /** Maximum UTF-16 code-unit length of `explanation`. */
  readonly maxExplanationCodeUnits?: number;
  /** Maximum UTF-16 code-unit length of a plain-text replacement. */
  readonly maxReplacementCodeUnits?: number;
}

interface ResolvedWritingDiagnosticLimits {
  readonly maxDiagnostics: number;
  readonly maxDiagnosticIdCodeUnits: number;
  readonly maxCategoryCodeUnits: number;
  readonly maxProvenanceCodeUnits: number;
  readonly maxTitleCodeUnits: number;
  readonly maxExplanationCodeUnits: number;
  readonly maxReplacementCodeUnits: number;
}

/** Hard package ceilings for one host-supplied writing-diagnostic set. */
export const DEFAULT_WRITING_DIAGNOSTIC_LIMITS = Object.freeze({
  maxDiagnostics: 256,
  maxDiagnosticIdCodeUnits: 256,
  maxCategoryCodeUnits: 128,
  maxProvenanceCodeUnits: 128,
  maxTitleCodeUnits: 256,
  maxExplanationCodeUnits: 4_000,
  maxReplacementCodeUnits: 20_000,
}) satisfies Readonly<ResolvedWritingDiagnosticLimits>;

/** Stable public failure classifications for writing-diagnostic handling. */
export type WritingDiagnosticErrorCode =
  | 'contract'
  | 'limit'
  | 'revision'
  | 'projection'
  | 'selector'
  | 'conflict'
  | 'lifecycle';

const ERROR_MESSAGES: Readonly<Record<WritingDiagnosticErrorCode, string>> =
  Object.freeze({
    contract: 'Writing diagnostic input is invalid.',
    limit: 'Writing diagnostic input exceeds the supported limit.',
    revision: 'Writing diagnostic revision evidence is invalid.',
    projection: 'Writing diagnostic text projection is unsupported.',
    selector: 'Writing diagnostic text selector is invalid.',
    conflict: 'Writing diagnostic input contains conflicting identifiers.',
    lifecycle: 'Writing diagnostic lifecycle state is invalid.',
  });

/** Raised when untrusted host diagnostic data cannot cross Inkspan's local boundary. */
export class WritingDiagnosticError extends TypeError {
  /** Stable redacted public failure classification. */
  readonly code: WritingDiagnosticErrorCode;

  constructor(code: WritingDiagnosticErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'WritingDiagnosticError';
    this.code = code;
  }
}

const DIAGNOSTIC_FIELDS = Object.freeze([
  'diagnosticId',
  'documentRevision',
  'textProjection',
  'selector',
  'categoryCode',
  'priority',
  'title',
  'explanation',
  'suggestedReplacement',
  'confidence',
  'provenance',
] as const);
const REQUIRED_DIAGNOSTIC_FIELDS = Object.freeze([
  'diagnosticId',
  'documentRevision',
  'textProjection',
  'selector',
  'categoryCode',
  'priority',
  'title',
  'explanation',
  'provenance',
] as const);
const REVISION_FIELDS = Object.freeze([
  'algorithm',
  'digestHex',
  'strongEntityTag',
] as const);
const PROJECTION_FIELDS = Object.freeze(['id', 'version'] as const);
const SELECTOR_FIELDS = Object.freeze(['type', 'start', 'end'] as const);
const PROVENANCE_FIELDS = Object.freeze([
  'workflowId',
  'workflowVersion',
  'judgePolicyVersion',
  'orchestrationMode',
] as const);
const REQUIRED_PROVENANCE_FIELDS = Object.freeze([
  'workflowId',
  'workflowVersion',
  'judgePolicyVersion',
] as const);
const LIMIT_FIELDS = Object.freeze([
  'maxDiagnostics',
  'maxDiagnosticIdCodeUnits',
  'maxCategoryCodeUnits',
  'maxProvenanceCodeUnits',
  'maxTitleCodeUnits',
  'maxExplanationCodeUnits',
  'maxReplacementCodeUnits',
] as const);
const PRIORITIES = new Set<CwlWritingDiagnosticPriority>([
  'advisory',
  'important',
  'critical',
]);
const LOWERCASE_SHA256 = /^[0-9a-f]{64}$/u;

type DataRecord = Readonly<Record<string, unknown>>;

/**
 * Validate and detach one complete host-supplied diagnostic set.
 *
 * The function performs no semantic text analysis and invokes no host callbacks,
 * model/provider APIs, network services, persistence services, or editor
 * transactions. Every accepted object is copied from own enumerable data
 * properties only and the returned tuple is deeply frozen.
 */
export function validateWritingDiagnostics(
  input: unknown,
  limits?: WritingDiagnosticLimits,
): readonly CwlWritingDiagnostic[] {
  const resolvedLimits = resolveLimits(limits);
  try {
    return validateWritingDiagnosticsWithLimits(input, resolvedLimits);
  } catch (error) {
    if (error instanceof WritingDiagnosticError) {
      throw error;
    }
    throw new WritingDiagnosticError('contract');
  }
}

function validateWritingDiagnosticsWithLimits(
  input: unknown,
  limits: ResolvedWritingDiagnosticLimits,
): readonly CwlWritingDiagnostic[] {
  if (!safeArrayIsArray(input)) {
    throw new WritingDiagnosticError('contract');
  }

  const length = readArrayLength(input);
  if (length > limits.maxDiagnostics) {
    throw new WritingDiagnosticError('limit');
  }
  validateDenseExactArray(input, length);

  const result: CwlWritingDiagnostic[] = [];
  const diagnosticIds = new Set<string>();
  for (let index = 0; index < length; index += 1) {
    const descriptor = safeOwnDescriptor(input, String(index), 'contract');
    if (descriptor === undefined || !isEnumerableDataDescriptor(descriptor)) {
      throw new WritingDiagnosticError('contract');
    }
    const diagnostic = validateDiagnostic(descriptor.value, limits);
    if (diagnosticIds.has(diagnostic.diagnosticId)) {
      throw new WritingDiagnosticError('conflict');
    }
    diagnosticIds.add(diagnostic.diagnosticId);
    result.push(diagnostic);
  }
  return Object.freeze(result);
}

function validateDiagnostic(
  value: unknown,
  limits: ResolvedWritingDiagnosticLimits,
): CwlWritingDiagnostic {
  const record = readExactObject(
    value,
    DIAGNOSTIC_FIELDS,
    REQUIRED_DIAGNOSTIC_FIELDS,
    'contract',
  );

  const diagnosticId = boundedRequiredString(
    record.diagnosticId,
    limits.maxDiagnosticIdCodeUnits,
  );
  const categoryCode = boundedRequiredString(
    record.categoryCode,
    limits.maxCategoryCodeUnits,
  );
  const title = boundedRequiredString(record.title, limits.maxTitleCodeUnits);
  const explanation = boundedString(
    record.explanation,
    limits.maxExplanationCodeUnits,
    true,
  );
  const suggestedReplacement = optionalBoundedString(
    record.suggestedReplacement,
    limits.maxReplacementCodeUnits,
  );
  const priority = validatePriority(record.priority);
  const confidence = validateConfidence(record.confidence);
  const documentRevision = validateRevision(record.documentRevision);
  const textProjection = validateProjection(record.textProjection);
  const selector = validateSelector(record.selector);
  const provenance = validateProvenance(record.provenance, limits);

  const detached: CwlWritingDiagnostic = {
    diagnosticId,
    documentRevision,
    textProjection,
    selector,
    categoryCode,
    priority,
    title,
    explanation,
    provenance,
  };
  if (suggestedReplacement !== undefined) {
    Object.defineProperty(detached, 'suggestedReplacement', {
      value: suggestedReplacement,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  if (confidence !== undefined) {
    Object.defineProperty(detached, 'confidence', {
      value: confidence,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(detached);
}

function validateRevision(value: unknown): CwlEditorDocumentRevision {
  const record = readExactObject(
    value,
    REVISION_FIELDS,
    REVISION_FIELDS,
    'revision',
  );
  const digestHex = record.digestHex;
  if (
    record.algorithm !== 'SHA-256' ||
    typeof digestHex !== 'string' ||
    digestHex.length !== 64 ||
    !LOWERCASE_SHA256.test(digestHex) ||
    record.strongEntityTag !== `"sha256-${digestHex}"`
  ) {
    throw new WritingDiagnosticError('revision');
  }
  return Object.freeze({
    algorithm: 'SHA-256' as const,
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  });
}

function validateProjection(value: unknown): CwlEditorTextProjectionIdentity {
  const record = readExactObject(
    value,
    PROJECTION_FIELDS,
    PROJECTION_FIELDS,
    'projection',
  );
  if (
    record.id !== TEXT_POSITION_PROJECTION_ID ||
    record.version !== TEXT_POSITION_PROJECTION_VERSION
  ) {
    throw new WritingDiagnosticError('projection');
  }
  return Object.freeze({
    id: TEXT_POSITION_PROJECTION_ID,
    version: TEXT_POSITION_PROJECTION_VERSION,
  });
}

function validateSelector(value: unknown): CwlEditorTextPositionSelector {
  const record = readExactObject(
    value,
    SELECTOR_FIELDS,
    SELECTOR_FIELDS,
    'selector',
  );
  const start = record.start;
  const end = record.end;
  if (
    record.type !== 'TextPositionSelector' ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    (start as number) < 0 ||
    (end as number) < (start as number)
  ) {
    throw new WritingDiagnosticError('selector');
  }
  return Object.freeze({
    type: 'TextPositionSelector' as const,
    start: start as number,
    end: end as number,
  });
}

function validateProvenance(
  value: unknown,
  limits: ResolvedWritingDiagnosticLimits,
): Readonly<CwlWritingDiagnosticProvenance> {
  const record = readExactObject(
    value,
    PROVENANCE_FIELDS,
    REQUIRED_PROVENANCE_FIELDS,
    'contract',
  );
  const workflowId = boundedRequiredString(
    record.workflowId,
    limits.maxProvenanceCodeUnits,
  );
  const workflowVersion = boundedRequiredString(
    record.workflowVersion,
    limits.maxProvenanceCodeUnits,
  );
  const judgePolicyVersion = boundedRequiredString(
    record.judgePolicyVersion,
    limits.maxProvenanceCodeUnits,
  );
  const orchestrationMode = optionalBoundedString(
    record.orchestrationMode,
    limits.maxProvenanceCodeUnits,
  );
  const result: CwlWritingDiagnosticProvenance = {
    workflowId,
    workflowVersion,
    judgePolicyVersion,
  };
  if (orchestrationMode !== undefined) {
    Object.defineProperty(result, 'orchestrationMode', {
      value: orchestrationMode,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(result);
}

function validatePriority(value: unknown): CwlWritingDiagnosticPriority {
  if (typeof value !== 'string' || !PRIORITIES.has(value as CwlWritingDiagnosticPriority)) {
    throw new WritingDiagnosticError('contract');
  }
  return value as CwlWritingDiagnosticPriority;
}

function validateConfidence(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new WritingDiagnosticError('contract');
  }
  return value;
}

function boundedRequiredString(value: unknown, maxCodeUnits: number): string {
  return boundedString(value, maxCodeUnits, false);
}

function optionalBoundedString(
  value: unknown,
  maxCodeUnits: number,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return boundedString(value, maxCodeUnits, true);
}

function boundedString(
  value: unknown,
  maxCodeUnits: number,
  allowEmpty: boolean,
): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new WritingDiagnosticError('contract');
  }
  if (value.length > maxCodeUnits) {
    throw new WritingDiagnosticError('limit');
  }
  return value;
}

function resolveLimits(
  limits: WritingDiagnosticLimits | undefined,
): ResolvedWritingDiagnosticLimits {
  if (limits === undefined) {
    return DEFAULT_WRITING_DIAGNOSTIC_LIMITS;
  }
  const record = readExactObject(limits, LIMIT_FIELDS, [], 'contract');
  const resolved: Record<keyof ResolvedWritingDiagnosticLimits, number> = {
    ...DEFAULT_WRITING_DIAGNOSTIC_LIMITS,
  };
  for (const key of LIMIT_FIELDS) {
    const value = record[key];
    if (value === undefined) {
      continue;
    }
    const hardMaximum = DEFAULT_WRITING_DIAGNOSTIC_LIMITS[key];
    if (
      !Number.isSafeInteger(value) ||
      (value as number) < 1 ||
      (value as number) > hardMaximum
    ) {
      throw new WritingDiagnosticError('contract');
    }
    resolved[key] = value as number;
  }
  return Object.freeze(resolved);
}

function readExactObject<K extends string>(
  value: unknown,
  allowedKeys: readonly K[],
  requiredKeys: readonly K[],
  errorCode: WritingDiagnosticErrorCode,
): DataRecord {
  if (
    typeof value !== 'object' ||
    value === null ||
    safeArrayIsArray(value)
  ) {
    throw new WritingDiagnosticError(errorCode);
  }

  let prototype: object | null;
  let keys: PropertyKey[];
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    throw new WritingDiagnosticError(errorCode);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new WritingDiagnosticError(errorCode);
  }

  const allowed = new Set<string>(allowedKeys);
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      throw new WritingDiagnosticError(errorCode);
    }
    const descriptor = safeOwnDescriptor(value, key, errorCode);
    if (descriptor === undefined || !isEnumerableDataDescriptor(descriptor)) {
      throw new WritingDiagnosticError(errorCode);
    }
    Object.defineProperty(result, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      throw new WritingDiagnosticError(errorCode);
    }
  }
  return result;
}

function safeArrayIsArray(value: unknown): value is unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    throw new WritingDiagnosticError('contract');
  }
}

function readArrayLength(value: unknown[]): number {
  const descriptor = safeOwnDescriptor(value, 'length', 'contract');
  if (
    descriptor === undefined ||
    !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
    typeof descriptor.value !== 'number' ||
    !Number.isSafeInteger(descriptor.value) ||
    descriptor.value < 0
  ) {
    throw new WritingDiagnosticError('contract');
  }
  return descriptor.value;
}

function validateDenseExactArray(value: unknown[], length: number): void {
  let keys: PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    throw new WritingDiagnosticError('contract');
  }
  if (keys.length !== length + 1 || !keys.includes('length')) {
    throw new WritingDiagnosticError('contract');
  }
  for (let index = 0; index < length; index += 1) {
    if (!keys.includes(String(index))) {
      throw new WritingDiagnosticError('contract');
    }
  }
  for (const key of keys) {
    if (key === 'length') {
      continue;
    }
    if (
      typeof key !== 'string' ||
      !Number.isSafeInteger(Number(key)) ||
      String(Number(key)) !== key ||
      Number(key) < 0 ||
      Number(key) >= length
    ) {
      throw new WritingDiagnosticError('contract');
    }
  }
}

function safeOwnDescriptor(
  value: object,
  key: PropertyKey,
  errorCode: WritingDiagnosticErrorCode,
): PropertyDescriptor | undefined {
  try {
    return Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new WritingDiagnosticError(errorCode);
  }
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor,
): descriptor is PropertyDescriptor & { value: unknown } {
  return (
    descriptor.enumerable === true &&
    Object.prototype.hasOwnProperty.call(descriptor, 'value')
  );
}
