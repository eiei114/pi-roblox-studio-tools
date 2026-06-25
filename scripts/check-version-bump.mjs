#!/usr/bin/env node
/**
 * PR guard: publishable paths changed => package.json semver must increase
 * and CHANGELOG.md must be updated in the same diff.
 *
 * Publishable paths: template defaults + package.json `files` + `pi.extensions`.
 * package.json itself is treated as a publishable change only when a
 * shipped-relevant field (dependencies/exports/files/version/...) changes;
 * devDependencies/scripts/metadata-only edits do not affect the published
 * package and must not force a version bump + CHANGELOG.
 *
 * Usage:
 *   node scripts/check-version-bump.mjs
 *   BASE_REF=origin/main node scripts/check-version-bump.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const TEMPLATE_DEFAULT = [
  "extensions/",
  "lib/",
  "skills/",
  "prompts/",
  "themes/",
  "src/",
  "bin/",
  "README.md",
  "CHANGELOG.md",
  "SECURITY.md",
];

/**
 * package.json keys whose values affect the published npm artifact. A diff that
 * only touches other keys (devDependencies, scripts, comments, ...) does not
 * change what consumers receive and therefore must not require a version bump.
 */
const SHIPPED_PKG_KEYS = [
  "name",
  "version",
  "type",
  "main",
  "module",
  "browser",
  "types",
  "typings",
  "bin",
  "exports",
  "files",
  "engines",
  "publishConfig",
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
  "bundleDependencies",
  "bundledDependencies",
  "pi",
];

const VALID_GIT_REF = /^[A-Za-z0-9._/-]+$/;

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`version:check fail — ${message}`);
  process.exit(1);
}

function assertValidGitRef(ref) {
  if (
    typeof ref !== "string" ||
    ref.length === 0 ||
    ref.startsWith("-") ||
    ref.startsWith(".") ||
    ref.includes("..") ||
    ref.includes("//") ||
    ref.endsWith("/") ||
    ref.endsWith(".lock") ||
    !VALID_GIT_REF.test(ref)
  ) {
    throw new Error(`Invalid BASE_REF format: ${ref}`);
  }
}

function parseSemver(v, context) {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`${context} is missing a valid version string`);
  }
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) throw new Error(`${context} has malformed semver: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareSemver(a, b) {
  const va = parseSemver(a, "head package.json version");
  const vb = parseSemver(b, "base package.json version");
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] - vb[i];
  }
  return 0;
}

function readPackageVersion(ref) {
  const raw = runGit(["show", `${ref}:package.json`]);
  const pkg = JSON.parse(raw);
  if (typeof pkg.version !== "string" || pkg.version.trim().length === 0) {
    throw new Error(`${ref}:package.json is missing a valid version field`);
  }
  return pkg.version;
}

function loadPublishablePaths() {
  const paths = new Set(TEMPLATE_DEFAULT);
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    for (const entry of pkg.files ?? []) {
      paths.add(String(entry).replace(/^\.\//, ""));
    }
    for (const ext of pkg.pi?.extensions ?? []) {
      if (typeof ext === "string") {
        paths.add(ext.replace(/^\.\//, ""));
      }
    }
    if (existsSync("index.ts")) paths.add("index.ts");
  } catch {
    // keep template defaults
  }
  return [...paths];
}

function isPublishablePath(file, publishable) {
  return publishable.some(
    (p) => file === p || (p.endsWith("/") && file.startsWith(p)),
  );
}

function readPackageJsonAt(ref) {
  const raw = runGit(["show", `${ref}:package.json`]);
  return JSON.parse(raw);
}

/**
 * Recursively sorts object keys so that deep-equality is order-insensitive.
 * Without this, reordering `dependencies` (e.g. re-sorting alphabetically)
 * without changing any version would produce a different JSON.stringify output
 * and falsely trip the publishable-changed check.
 */
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonicalize(v)]),
    );
  }
  return value;
}

/**
 * Returns true when a shipped-relevant package.json field differs between the
 * base ref and the working tree. Fails safe (true) if either side cannot be
 * read/parsed so the guard never silently approves an unreadable manifest.
 */
function shippedPkgFieldsChanged(baseRef) {
  let base;
  let head;
  try {
    base = readPackageJsonAt(baseRef);
    head = JSON.parse(readFileSync("package.json", "utf8"));
  } catch {
    return true;
  }
  return SHIPPED_PKG_KEYS.some(
    (k) =>
      JSON.stringify(canonicalize(base[k])) !==
      JSON.stringify(canonicalize(head[k])),
  );
}

const baseRef = process.env.BASE_REF ?? "origin/main";
try {
  assertValidGitRef(baseRef);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
const publishable = loadPublishablePaths();

let changed;
try {
  runGit(["rev-parse", "--verify", `${baseRef}^{commit}`]);
  changed = runGit(["diff", "--name-only", `${baseRef}...HEAD`]).split("\n").filter(Boolean);
} catch {
  console.log("version:check skip — base ref not available (local run?)");
  process.exit(0);
}

// A path-level change (lib/, extensions/, ...) is always publishable. A bare
// package.json edit is only publishable when a shipped field changed, so
// devDependencies/metadata-only PRs are not blocked.
const publishableChanged =
  changed.some((f) => isPublishablePath(f, publishable)) ||
  (changed.includes("package.json") && shippedPkgFieldsChanged(baseRef));
if (!publishableChanged) {
  console.log("version:check ok — no publishable paths changed");
  process.exit(0);
}

let baseVersion;
try {
  baseVersion = readPackageVersion(baseRef);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const headPkg = JSON.parse(readFileSync("package.json", "utf8"));
if (typeof headPkg.version !== "string" || headPkg.version.trim().length === 0) {
  fail("package.json is missing a valid version field");
}
const headVersion = headPkg.version;

let versionDelta;
try {
  versionDelta = compareSemver(headVersion, baseVersion);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

if (versionDelta <= 0) {
  console.error(
    `version:check fail — publishable files changed but package.json version did not increase (${baseVersion} -> ${headVersion}). Bump patch/minor/major per issue metadata.`,
  );
  process.exit(1);
}

if (!changed.includes("CHANGELOG.md")) {
  console.error(
    "version:check fail — publishable files changed and version bumped, but CHANGELOG.md was not updated in this PR.",
  );
  process.exit(1);
}

console.log(
  `version:check ok — ${baseVersion} -> ${headVersion}, CHANGELOG.md updated`,
);
process.exit(0);
