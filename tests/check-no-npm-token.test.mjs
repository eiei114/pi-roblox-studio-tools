import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = fileURLToPath(
  new URL("../scripts/check-no-npm-token.mjs", import.meta.url),
);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function runGuard(rootDir) {
  return execFileSync("node", [scriptPath, rootDir], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

test("publish guard passes on repository workflows", () => {
  const output = runGuard(repoRoot);
  assert.match(output, /publish:guard ok/);
});

test("publish guard fails when a workflow references NPM_TOKEN", () => {
  const dir = mkdtempSync(join(tmpdir(), "publish-guard-"));
  const workflowsDir = join(dir, ".github", "workflows");
  mkdirSync(workflowsDir, { recursive: true });
  writeFileSync(
    join(workflowsDir, "publish.yml"),
    "env:\n  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n",
  );

  try {
    execFileSync("node", [scriptPath, dir], { stdio: "pipe" });
    assert.fail("expected publish guard to fail");
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    assert.match(output, /NPM_TOKEN|NODE_AUTH_TOKEN/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
