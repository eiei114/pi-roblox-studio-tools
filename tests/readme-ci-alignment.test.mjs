import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const packageJson = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
const readme = readFileSync(`${root}/README.md`, "utf8");

function extractCiScriptNames(ciScript) {
  const names = [];
  for (const part of ciScript.split("&&").map((segment) => segment.trim())) {
    const runMatch = part.match(/^npm run (\S+)$/);
    if (runMatch) {
      names.push(runMatch[1]);
      continue;
    }
    if (part === "npm test") {
      names.push("test");
    }
  }
  return names;
}

function readmeMentionsScript(section, scriptName) {
  if (scriptName === "test") {
    return /\btests?\b/.test(section);
  }
  return section.includes(scriptName);
}

test("README Development section documents every npm run ci step", () => {
  const developmentStart = readme.indexOf("## Development");
  assert.notEqual(developmentStart, -1, "README must include a Development section");

  const developmentSection = readme.slice(developmentStart);
  const ciScripts = extractCiScriptNames(packageJson.scripts.ci);

  for (const script of ciScripts) {
    assert.ok(
      readmeMentionsScript(developmentSection, script),
      `README Development section must mention ${script} because it is part of npm run ci`,
    );
  }
});
