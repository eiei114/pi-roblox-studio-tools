import assert from "node:assert/strict";
import test from "node:test";

const { runOneShotMcpRequest } = await import("../lib/stdio-mcp-client.ts");

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