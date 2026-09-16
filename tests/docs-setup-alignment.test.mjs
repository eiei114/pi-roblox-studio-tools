import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const readme = readFileSync(`${root}/README.md`, "utf8");
const setup = readFileSync(`${root}/docs/setup.md`, "utf8");
const extensionSource = readFileSync(`${root}/extensions/index.ts`, "utf8");

function extractRegisteredToolNames(source) {
  const names = [];
  for (const match of source.matchAll(/registerTool\(\{[\s\S]*?name:\s*"([^"]+)"/g)) {
    names.push(match[1]);
  }
  return names;
}

test("README links to docs/setup.md", () => {
  assert.match(readme, /docs\/setup\.md/);
});

test("docs/setup.md documents the end-user verification sequence", () => {
  const toolOrder = [
    "roblox_studio_mcp_status",
    "roblox_studio_mcp_list_tools",
    "roblox_studio_mcp_list_studios",
  ];

  let lastIndex = -1;
  for (const tool of toolOrder) {
    const index = setup.indexOf(tool);
    assert.notEqual(index, -1, `setup doc must mention ${tool}`);
    assert.ok(index > lastIndex, `setup doc must mention ${tool} after prior tools`);
    lastIndex = index;
  }

  assert.match(setup, /\/roblox-studio-mcp-status/);
  assert.match(setup, /callable:\s*true/i);
  assert.match(setup, /found_not_callable/);
  assert.match(setup, /npm run ci/);
});

test("docs/setup.md lists every registered Pi tool", () => {
  const registeredTools = extractRegisteredToolNames(extensionSource).sort();

  for (const tool of registeredTools) {
    assert.match(setup, new RegExp(tool), `setup doc must mention registered tool ${tool}`);
  }
});
