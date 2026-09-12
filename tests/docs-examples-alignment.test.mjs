import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const extensionSource = readFileSync(`${root}/extensions/index.ts`, "utf8");
const examples = readFileSync(`${root}/docs/examples.md`, "utf8");

function extractRegisteredToolNames(source) {
  const names = [];
  for (const match of source.matchAll(/registerTool\(\{[\s\S]*?name:\s*"([^"]+)"/g)) {
    names.push(match[1]);
  }
  return names;
}

function extractRegisteredCommandNames(source) {
  const names = [];
  for (const match of source.matchAll(/registerCommand\("([^"]+)"/g)) {
    names.push(match[1]);
  }
  return names;
}

function extractExamplesSection(markdown, heading) {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const rest = markdown.slice(start + heading.length);
  const nextHeading = rest.search(/\n## /);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading);
}

function extractBulletBacktickItems(section) {
  return [
    ...section.matchAll(/^-\s+`([^`]+)`/gm),
  ].map((match) => match[1]);
}

test("docs/examples.md lists only registered Pi tools and commands", () => {
  const registeredTools = extractRegisteredToolNames(extensionSource);
  const registeredCommands = extractRegisteredCommandNames(extensionSource).map(
    (name) => `/${name}`,
  );

  const commandSection = extractExamplesSection(examples, "## Extension command");
  const toolSection = extractExamplesSection(examples, "## Custom tools");

  const documentedCommands = extractBulletBacktickItems(commandSection);
  const documentedTools = extractBulletBacktickItems(toolSection);

  assert.deepEqual(
    documentedCommands.sort(),
    registeredCommands.sort(),
    "documented commands must match extensions/index.ts",
  );
  assert.deepEqual(
    documentedTools.sort(),
    registeredTools.sort(),
    "documented tools must match extensions/index.ts",
  );
});

test("docs/examples.md documents inventory workflow in recommended order", () => {
  const workflowSection = extractExamplesSection(examples, "## Recommended workflow");
  const toolOrder = [
    "roblox_studio_mcp_status",
    "roblox_studio_mcp_list_tools",
    "roblox_studio_mcp_list_studios",
  ];

  let lastIndex = -1;
  for (const tool of toolOrder) {
    const index = workflowSection.indexOf(tool);
    assert.notEqual(index, -1, `workflow must mention ${tool}`);
    assert.ok(index > lastIndex, `workflow must mention ${tool} after prior tools`);
    lastIndex = index;
  }

  assert.match(workflowSection, /callable:\s*true/i);
  assert.match(workflowSection, /found_not_callable/i);
});
