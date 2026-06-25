import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = fileURLToPath(
  new URL("../scripts/check-version-bump.mjs", import.meta.url),
);

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).toString().trim();
}

function basePackage(overrides = {}) {
  return JSON.stringify(
    {
      name: "test-pkg",
      version: "0.1.0",
      files: ["lib/"],
      dependencies: { foo: "^1.0.0" },
      devDependencies: { "@types/node": "^22.0.0" },
      ...overrides,
    },
    null,
    2,
  );
}

function setupRepo() {
  const dir = mkdtempSync(join(tmpdir(), "vcheck-"));
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  writeFileSync(join(dir, "package.json"), basePackage());
  writeFileSync(
    join(dir, "CHANGELOG.md"),
    "# Changelog\n\n## [0.1.0]\n\n- init\n",
  );
  mkdirSync(join(dir, "lib"), { recursive: true });
  writeFileSync(join(dir, "lib", "index.js"), "module.exports = 1;\n");
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "base"]);
  return dir;
}

function commitOnBranch(dir, mutator, message) {
  git(dir, ["checkout", "-q", "-b", "feature"]);
  mutator(dir);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", message]);
}

function writePackage(dir, overrides) {
  writeFileSync(join(dir, "package.json"), basePackage(overrides));
}

function runGuard(dir) {
  let result;
  try {
    const out = execFileSync("node", [scriptPath], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, BASE_REF: "main" },
    });
    result = { code: 0, stdout: out.toString().trim(), stderr: "" };
  } catch (error) {
    result = {
      code: error.status ?? 1,
      stdout: (error.stdout ?? "").toString().trim(),
      stderr: (error.stderr ?? "").toString().trim(),
    };
  }
  return result;
}

function withRepo(scenario) {
  return () => {
    const dir = setupRepo();
    try {
      scenario(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

test(
  "devDependencies-only bump is not publishable (Dependabot PR scenario)",
  withRepo((dir) => {
    commitOnBranch(dir, (d) => {
      writePackage(d, { devDependencies: { "@types/node": "^26.0.0" } });
    }, "bump devDeps");
    const r = runGuard(dir);
    assert.equal(r.code, 0, `expected pass, stderr=${r.stderr}`);
    assert.match(r.stdout, /no publishable paths changed/);
  }),
);

test(
  "scripts/metadata-only edits are not publishable",
  withRepo((dir) => {
    commitOnBranch(dir, (d) => {
      mkdirSync(join(d, "scripts"), { recursive: true });
      writeFileSync(join(d, "scripts", "noop.js"), "// noop\n");
    }, "add script");
    const r = runGuard(dir);
    assert.equal(r.code, 0, `expected pass, stderr=${r.stderr}`);
    assert.match(r.stdout, /no publishable paths changed/);
  }),
);

test(
  "adding a runtime dependency still requires a version bump",
  withRepo((dir) => {
    commitOnBranch(dir, (d) => {
      writePackage(d, { dependencies: { foo: "^1.0.0", bar: "^2.0.0" } });
    }, "add dep");
    const r = runGuard(dir);
    assert.equal(r.code, 1, "expected guard to reject without version bump");
    assert.match(r.stderr, /version did not increase/);
  }),
);

test(
  "adding a runtime dependency with version bump + CHANGELOG passes",
  withRepo((dir) => {
    commitOnBranch(dir, (d) => {
      writePackage(d, {
        version: "0.1.1",
        dependencies: { foo: "^1.0.0", bar: "^2.0.0" },
      });
      writeFileSync(
        join(d, "CHANGELOG.md"),
        "# Changelog\n\n## [0.1.1]\n\n- add bar\n\n## [0.1.0]\n\n- init\n",
      );
    }, "add dep + bump");
    const r = runGuard(dir);
    assert.equal(r.code, 0, `expected pass, stderr=${r.stderr}`);
    assert.match(r.stdout, /0\.1\.0 -> 0\.1\.1.*CHANGELOG\.md updated/s);
  }),
);

test(
  "changing a publish-affecting field (files) requires a version bump",
  withRepo((dir) => {
    commitOnBranch(dir, (d) => {
      writePackage(d, { files: ["lib/", "dist/"] });
    }, "expand files");
    const r = runGuard(dir);
    assert.equal(r.code, 1, "expected guard to reject files change without bump");
    assert.match(r.stderr, /version did not increase/);
  }),
);

test(
  "lib/ content change still requires a version bump",
  withRepo((dir) => {
    commitOnBranch(dir, (d) => {
      writeFileSync(join(d, "lib", "index.js"), "module.exports = 2;\n");
    }, "edit lib");
    const r = runGuard(dir);
    assert.equal(r.code, 1, "expected guard to reject lib/ change without bump");
    assert.match(r.stderr, /version did not increase/);
  }),
);
