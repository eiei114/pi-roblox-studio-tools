import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const releaseWorkflow = await readFile(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");
const publishWorkflow = await readFile(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");

test("ordinary main merges cannot start automatic release or npm publication", () => {
  const releaseTriggers = releaseWorkflow.split("jobs:")[0];
  const publishTriggers = publishWorkflow.split("permissions:")[0];
  assert.match(releaseTriggers, /on:\s*\r?\n\s+workflow_dispatch:/);
  assert.doesNotMatch(releaseTriggers, /\r?\n\s+push:/);
  assert.match(releaseWorkflow, /if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
  assert.match(releaseWorkflow, /stable semver/);
  assert.match(releaseWorkflow, /git tag -l/);
  assert.doesNotMatch(releaseWorkflow, /github\.event\.before|PREVIOUS_VERSION/);
  assert.match(publishTriggers, /push:\s*\r?\n\s+tags:\s*\r?\n\s+- ['"]v\*\.\*\.\*['"]/);
  assert.doesNotMatch(publishTriggers, /branches:|paths:/);
});
