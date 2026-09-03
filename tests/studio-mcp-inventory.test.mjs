import assert from "node:assert/strict";
import test from "node:test";

const {
  capStderr,
  capText,
  listRobloxStudios,
  listStudioMcpTools,
  MAX_TOOL_DESCRIPTION_CHARS,
  MAX_TOOL_ENTRIES,
  sanitizeText,
} = await import("../lib/studio-mcp-inventory.ts");

const fakeListToolsServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "fake", version: "0.0.0" } } }));
    return;
  }
  if (message.method === "tools/list") {
    const tools = Array.from({ length: 30 }, (_, index) => ({
      name: "tool_" + index,
      description: "Description for tool " + index + " with extra padding to test truncation behavior",
    }));
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools } }));
    return;
  }
  if (message.id !== undefined) {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } }));
  }
});
`;

const malformedListToolsServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }));
    return;
  }
  if (message.method === "tools/list") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: "not-an-array" } }));
    return;
  }
});
`;

const jsonRpcErrorServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }));
    return;
  }
  if (message.method === "tools/list") {
    process.stderr.write("bridge disconnected\n");
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32000, message: "tools/list failed" } }));
    return;
  }
});
`;

const listStudiosServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "list_roblox_studios") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: JSON.stringify([{ id: "studio-1", title: "Place1" }, { id: "studio-2", title: "Place2" }]) }] } }));
    return;
  }
  if (message.id !== undefined) {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } }));
  }
});
`;

const noStudiosServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "list_roblox_studios") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "[]" }] } }));
    return;
  }
});
`;

const missingListStudiosToolServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "list_roblox_studios") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Unknown tool: list_roblox_studios" } }));
    return;
  }
});
`;

function fakeCommand(serverSource) {
  return { command: process.execPath, args: ["-e", serverSource], source: "node fake server" };
}

function callableResolve(serverSource) {
  return async () => ({
    supported: true,
    platform: "win32",
    found: true,
    callable: true,
    readiness: "callable",
    command: fakeCommand(serverSource),
    checked: [fakeCommand(serverSource).command],
    message: "callable",
  });
}

function notFoundResolve() {
  return async () => ({
    supported: true,
    platform: "win32",
    found: false,
    callable: false,
    readiness: "not_found",
    checked: ["C:\\missing\\mcp.bat"],
    message: "not found",
  });
}

test("sanitizeText strips ANSI and control characters", () => {
  assert.equal(sanitizeText("\u001B[31mhello\u0007world"), "helloworld");
});

test("capText enforces byte limits", () => {
  const capped = capText("x".repeat(100), 20);
  assert.equal(capped.truncated, true);
  assert.ok(Buffer.byteLength(capped.text, "utf8") <= 20);
});

test("capStderr limits stderr excerpts", () => {
  const capped = capStderr("e".repeat(5000));
  assert.ok(Buffer.byteLength(capped.excerpt, "utf8") <= 2048);
});

test("listStudioMcpTools formats successful tools/list output with caps", async () => {
  const result = await listStudioMcpTools({
    resolve: callableResolve(fakeListToolsServer),
    timeoutMs: 2000,
  });

  assert.equal(result.details.toolCount, 30);
  assert.equal(result.details.tools?.length, MAX_TOOL_ENTRIES);
  assert.equal(result.details.truncated, true);
  assert.match(result.text, /StudioMCP exposes 30 tool/);
  assert.ok((result.details.tools?.[0].description.length ?? 0) <= MAX_TOOL_DESCRIPTION_CHARS);
});

test("listStudioMcpTools does not spawn when StudioMCP is missing", async () => {
  let spawned = false;
  const result = await listStudioMcpTools({
    resolve: notFoundResolve(),
    runRequest: async () => {
      spawned = true;
      throw new Error("should not spawn");
    },
  });

  assert.equal(spawned, false);
  assert.equal(result.details.readiness, "not_found");
  assert.match(result.text, /Install or update Roblox Studio/i);
});

test("listStudioMcpTools handles malformed tools/list responses", async () => {
  const result = await listStudioMcpTools({
    resolve: callableResolve(malformedListToolsServer),
    timeoutMs: 2000,
  });

  assert.match(result.text, /Failed to list StudioMCP tools/i);
  assert.match(result.details.error ?? "", /must be an array/i);
});

test("listStudioMcpTools surfaces JSON-RPC errors with stderr excerpt", async () => {
  const result = await listStudioMcpTools({
    resolve: callableResolve(jsonRpcErrorServer),
    timeoutMs: 2000,
  });

  assert.equal(result.details.mcpError?.code, -32000);
  assert.match(result.text, /Failed to list StudioMCP tools/i);
});

test("listRobloxStudios returns successful Studio inventory", async () => {
  const result = await listRobloxStudios({
    resolve: callableResolve(listStudiosServer),
    timeoutMs: 2000,
  });

  assert.equal(result.details.studioCount, 2);
  assert.match(result.text, /Detected 2 Roblox Studio instance/);
  assert.ok(result.details.rawExcerpt?.includes("studio-1"));
});

test("listRobloxStudios reports zero Studio instances with guidance", async () => {
  const result = await listRobloxStudios({
    resolve: callableResolve(noStudiosServer),
    timeoutMs: 2000,
  });

  assert.equal(result.details.studioCount, 0);
  assert.match(result.text, /Open Roblox Studio/i);
});

test("listRobloxStudios guides when list_roblox_studios is missing", async () => {
  const result = await listRobloxStudios({
    resolve: callableResolve(missingListStudiosToolServer),
    timeoutMs: 2000,
  });

  assert.match(result.text, /does not expose the read-only list_roblox_studios tool/i);
  assert.equal(result.details.mcpError?.code, -32601);
});

test("extensions register inventory tools aligned with docs expectations", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const extensionSource = readFileSync(`${root}/extensions/index.ts`, "utf8");

  assert.match(extensionSource, /name: "roblox_studio_mcp_list_tools"/);
  assert.match(extensionSource, /name: "roblox_studio_mcp_list_studios"/);
  assert.doesNotMatch(extensionSource, /roblox_studio_mcp_call_tool/);
});
