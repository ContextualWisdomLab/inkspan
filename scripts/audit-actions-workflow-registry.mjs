#!/usr/bin/env node

/**
 * Classify a bounded, already-fetched GitHub Actions workflow-registry snapshot.
 *
 * This detector is deliberately read-only. A trusted caller gathers the exact
 * default-branch tree and every paginated Actions workflow page, writes the
 * bounded JSON fixture, and invokes this script. The script never calls GitHub,
 * reads credentials, disables a workflow, restores source, or mutates a ref.
 */
import { readFileSync } from 'node:fs';

const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_PATH_CODE_UNITS = 1024;
const MAX_PAGES = 1000;
const MAX_WORKFLOWS = 100_000;
const SHA_1 = /^[0-9a-f]{40}$/u;
const REPOSITORY_WORKFLOW_PREFIX = '.github/workflows/';
const GITHUB_DYNAMIC_PREFIX = 'dynamic/';

/** Write one bounded operator-facing failure and terminate without JSON output. */
function fail(message) {
  process.stderr.write(`workflow registry audit failed: ${message}\n`);
  process.exitCode = 1;
}

/** Return whether a value is a plain JSON object. */
function isRecord(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Return whether an object has exactly the documented keys. */
function hasExactKeys(record, requiredKeys, optionalKeys = []) {
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const keys = Object.keys(record);
  return (
    requiredKeys.every((key) => Object.hasOwn(record, key)) &&
    keys.every((key) => allowed.has(key))
  );
}

/** Validate one bounded opaque path supplied by GitHub or the tree collector. */
function isBoundedPath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_PATH_CODE_UNITS &&
    !value.includes('\u0000') &&
    !value.includes('\\') &&
    !value.startsWith('/')
  );
}

/** Validate one canonical workflow source path from the protected tree. */
function isCanonicalRepositoryWorkflowPath(value) {
  return (
    isBoundedPath(value) &&
    value.startsWith(REPOSITORY_WORKFLOW_PREFIX) &&
    !value.includes('%') &&
    !value.split('/').includes('..')
  );
}

/** Parse and strictly validate command-line arguments. */
function readInputArgument(argv) {
  if (argv.length !== 2 || argv[0] !== '--input' || argv[1].length === 0) {
    throw new Error('usage: audit-actions-workflow-registry.mjs --input <path>');
  }
  return argv[1];
}

/** Read one bounded JSON fixture without following any repository-controlled URL. */
function readFixture(inputPath) {
  const bytes = readFileSync(inputPath);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_INPUT_BYTES) {
    throw new Error('input size is outside the supported bound');
  }
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('input is not valid JSON');
  }
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      ['defaultBranchSha', 'observedAt', 'presentWorkflowPaths', 'pages'],
      ['ownedActiveRepairPaths'],
    )
  ) {
    throw new Error('input has an invalid top-level contract');
  }
  return value;
}

/** Validate and detach one bounded unique path list. */
function readPathList(value, label, canonicalOnly) {
  if (!Array.isArray(value) || value.length > MAX_WORKFLOWS) {
    throw new Error(`${label} is invalid`);
  }
  const result = [];
  const seen = new Set();
  for (const path of value) {
    const valid = canonicalOnly
      ? isCanonicalRepositoryWorkflowPath(path)
      : isBoundedPath(path);
    if (!valid || seen.has(path)) {
      throw new Error(`${label} contains an invalid or duplicate path`);
    }
    seen.add(path);
    result.push(path);
  }
  return Object.freeze(result);
}

/** Validate one exact GitHub workflow registry item. */
function readWorkflowItem(value) {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['id', 'path', 'state']) ||
    !Number.isSafeInteger(value.id) ||
    value.id <= 0 ||
    !isBoundedPath(value.path) ||
    typeof value.state !== 'string' ||
    value.state.length === 0 ||
    value.state.length > 32
  ) {
    throw new Error('workflow registry item is invalid');
  }
  return Object.freeze({ id: value.id, path: value.path, state: value.state });
}

/** Validate all pages and prove that pagination accounts for the advertised total. */
function readCompletePages(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PAGES) {
    throw new Error('workflow registry pages are invalid');
  }

  const items = [];
  const receipts = [];
  const workflowIds = new Set();
  let expectedTotal = null;

  for (let index = 0; index < value.length; index += 1) {
    const page = value[index];
    if (
      !isRecord(page) ||
      !hasExactKeys(page, ['page', 'perPage', 'totalCount', 'items']) ||
      !Number.isSafeInteger(page.page) ||
      page.page !== index + 1 ||
      !Number.isSafeInteger(page.perPage) ||
      page.perPage < 1 ||
      page.perPage > 100 ||
      !Number.isSafeInteger(page.totalCount) ||
      page.totalCount < 0 ||
      page.totalCount > MAX_WORKFLOWS ||
      !Array.isArray(page.items) ||
      page.items.length > page.perPage
    ) {
      throw new Error('workflow registry page is invalid');
    }
    if (expectedTotal === null) {
      expectedTotal = page.totalCount;
    } else if (page.totalCount !== expectedTotal) {
      throw new Error('workflow registry total changed between pages');
    }

    for (const rawItem of page.items) {
      const item = readWorkflowItem(rawItem);
      if (workflowIds.has(item.id)) {
        throw new Error('workflow registry contains a duplicate workflow id');
      }
      workflowIds.add(item.id);
      items.push(item);
    }
    receipts.push(
      Object.freeze({
        page: page.page,
        itemCount: page.items.length,
        totalCount: page.totalCount,
      }),
    );
  }

  if (items.length !== expectedTotal) {
    throw new Error('workflow registry pagination is incomplete');
  }
  return Object.freeze({
    items: Object.freeze(items),
    receipts: Object.freeze(receipts),
  });
}

/** Classify one registry record without filename or workflow-name heuristics. */
function classifyWorkflow(path, state, presentPaths, ownedRepairPaths, foldedPaths) {
  if (state !== 'active') {
    return 'disabled';
  }
  if (path.startsWith(GITHUB_DYNAMIC_PREFIX)) {
    return 'github_dynamic';
  }
  if (path.includes('%')) {
    return 'unresolved_path';
  }
  if (presentPaths.has(path)) {
    return 'present';
  }
  if (ownedRepairPaths.has(path)) {
    return 'owned_active_repair';
  }
  if (foldedPaths.has(path.toLocaleLowerCase('en-US'))) {
    return 'path_mismatch';
  }
  if (path.startsWith(REPOSITORY_WORKFLOW_PREFIX)) {
    return 'active_orphan';
  }
  return 'unresolved_path';
}

/** Produce frozen deterministic audit evidence from one validated fixture. */
function auditFixture(fixture) {
  if (!SHA_1.test(fixture.defaultBranchSha)) {
    throw new Error('default branch SHA is invalid');
  }
  if (
    typeof fixture.observedAt !== 'string' ||
    Number.isNaN(Date.parse(fixture.observedAt)) ||
    new Date(fixture.observedAt).toISOString() !== fixture.observedAt
  ) {
    throw new Error('observation time is invalid');
  }

  const presentList = readPathList(
    fixture.presentWorkflowPaths,
    'present workflow paths',
    true,
  );
  const ownedRepairList = readPathList(
    fixture.ownedActiveRepairPaths ?? [],
    'owned active repair paths',
    true,
  );
  const presentPaths = new Set(presentList);
  const ownedRepairPaths = new Set(ownedRepairList);
  const foldedPaths = new Set(
    [...presentList, ...ownedRepairList].map((path) =>
      path.toLocaleLowerCase('en-US'),
    ),
  );
  const pages = readCompletePages(fixture.pages);

  return Object.freeze({
    defaultBranchSha: fixture.defaultBranchSha,
    observedAt: fixture.observedAt,
    complete: true,
    paginationReceipts: pages.receipts,
    workflows: Object.freeze(
      pages.items.map((item) =>
        Object.freeze({
          ...item,
          classification: classifyWorkflow(
            item.path,
            item.state,
            presentPaths,
            ownedRepairPaths,
            foldedPaths,
          ),
        }),
      ),
    ),
  });
}

try {
  const inputPath = readInputArgument(process.argv.slice(2));
  const evidence = auditFixture(readFixture(inputPath));
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'unexpected validation failure');
}
