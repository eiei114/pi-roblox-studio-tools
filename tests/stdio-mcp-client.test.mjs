import assert from "node:assert/strict";
import test from "node:test";

const { runOneShotMcpRequest, runOneShotMcpRequests } = await import("../lib/stdio-mcp-client.ts");

const fakeServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "fake", version: "0.0.0" } } }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "set_active_studio") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "active=" + message.params.arguments.studio_id }] } }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "search_game_tree") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "searched=" + message.params.arguments.keywords }] } }));
    return;
  }
  if (message.method === "tools/list") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "fake_tool", description: "Fake tool" }] } }));
    return;
  }
  if (message.id !== undefined) {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } }));
  }
});
`;

test("runOneShotMcpRequest initializes, sends one request, and returns result", async () => {
  const result = await runOneShotMcpRequest(
    { command: process.execPath, args: ["-e", fakeServer], source: "node fake server" },
    "tools/list",
    undefined,
    { timeoutMs: 2000 },
  );

  assert.deepEqual(result.response.result, { tools: [{ name: "fake_tool", description: "Fake tool" }] });
});

test("runOneShotMcpRequest surfaces JSON-RPC errors", async () => {
  await assert.rejects(
    () =>
      runOneShotMcpRequest(
        { command: process.execPath, args: ["-e", fakeServer], source: "node fake server" },
        "missing/method",
        undefined,
        { timeoutMs: 2000 },
      ),
    /MCP error -32601: Method not found/,
  );
});
test("runOneShotMcpRequests supports multiple requests in one process", async () => {
  const result = await runOneShotMcpRequests(
    { command: process.execPath, args: ["-e", fakeServer], source: "node fake server" },
    [
      { method: "tools/call", params: { name: "set_active_studio", arguments: { studio_id: "studio-1" } } },
      { method: "tools/call", params: { name: "search_game_tree", arguments: { keywords: "WeponASet" } } },
    ],
    { timeoutMs: 2000 },
  );

  assert.equal(result.responses.length, 2);
  assert.deepEqual(result.responses[0].result, { content: [{ type: "text", text: "active=studio-1" }] });
  assert.deepEqual(result.responses[1].result, { content: [{ type: "text", text: "searched=WeponASet" }] });
});