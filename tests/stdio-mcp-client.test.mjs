import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

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

function trackProcessOptions(extra = {}) {
  const tracking = { child: undefined, started: 0, stopped: 0 };
  return {
    tracking,
    options: {
      ...extra,
      onProcess(child) {
        tracking.child = child;
        tracking.started++;
        extra.onProcess?.(child);
      },
      onProcessExit(child) {
        assert.equal(child, tracking.child);
        tracking.stopped++;
        extra.onProcessExit?.(child);
      },
    },
  };
}

function assertProcessFinished(tracking) {
  assert.ok(tracking.child, "a child process was spawned");
  assert.equal(tracking.started, 1);
  assert.equal(tracking.stopped, 1);
  assert.ok(
    tracking.child.exitCode !== null || tracking.child.signalCode !== null,
    "the child process exited before the request returned",
  );
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

async function waitForProcessExit(pid, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (isProcessRunning(pid)) {
    if (Date.now() >= deadline) assert.fail(`helper process ${pid} did not exit`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test("getClientInfo version matches package.json", async () => {
  const { getClientInfo } = await import("../lib/client-info.ts");

  assert.equal(getClientInfo().name, "pi-roblox-studio-tools");
  assert.equal(getClientInfo().version, packageJson.version);
});

test("runOneShotMcpRequest sends package.json version in initialize clientInfo", async () => {
  const versionCaptureServer = String.raw`
const readline = require("node:readline");
let initClientVersion;
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    initClientVersion = message.params?.clientInfo?.version;
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "fake", version: "0.0.0" } } }));
    return;
  }
  if (message.method === "tools/list") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: [], clientVersion: initClientVersion } }));
    return;
  }
  if (message.id !== undefined) {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } }));
  }
});
`;

  const result = await runOneShotMcpRequest(
    { command: process.execPath, args: ["-e", versionCaptureServer], source: "node version capture server" },
    "tools/list",
    undefined,
    { timeoutMs: 2000 },
  );

  assert.equal(result.response.result.clientVersion, packageJson.version);
});

test("probeStudioMcpInitialize completes initialize without follow-up requests", async () => {
  const { probeStudioMcpInitialize } = await import("../lib/stdio-mcp-client.ts");

  const result = await probeStudioMcpInitialize(
    { command: process.execPath, args: ["-e", fakeServer], source: "node fake server" },
    { timeoutMs: 2000 },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.serverInfo, { name: "fake", version: "0.0.0" });
  assert.equal(result.error, undefined);
});

test("probeStudioMcpInitialize reports initialization errors and balances process tracking", async () => {
  const { probeStudioMcpInitialize } = await import("../lib/stdio-mcp-client.ts");
  const errorServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32000, message: "initialize rejected" } }));
  }
});
`;
  let started = 0;
  let stopped = 0;

  const result = await probeStudioMcpInitialize(
    { command: process.execPath, args: ["-e", errorServer], source: "node initialize error server" },
    {
      timeoutMs: 2000,
      onProcess: () => started++,
      onProcessExit: () => stopped++,
    },
  );

  assert.deepEqual(result, {
    ok: false,
    error: "MCP error -32000: initialize rejected",
    stderr: "",
  });
  assert.equal(started, 1);
  assert.equal(stopped, 1);
});

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

test("runOneShotMcpRequest rejects incomplete JSON-RPC responses", async () => {
  const incompleteServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id !== undefined) console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id }));
});
`;

  await assert.rejects(
    () =>
      runOneShotMcpRequest(
        { command: process.execPath, args: ["-e", incompleteServer], source: "node incomplete server" },
        "tools/list",
        undefined,
        { timeoutMs: 2000 },
      ),
    /Invalid MCP JSON-RPC response \(response must contain exactly one of result or error\)/,
  );
});

test("runOneShotMcpRequest rejects malformed JSON-RPC error responses", async () => {
  const malformedErrorServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }));
    return;
  }
  if (message.id !== undefined) console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { message: "missing code" } }));
});
`;

  await assert.rejects(
    () =>
      runOneShotMcpRequest(
        { command: process.execPath, args: ["-e", malformedErrorServer], source: "node malformed error server" },
        "tools/list",
        undefined,
        { timeoutMs: 2000 },
      ),
    /Invalid MCP JSON-RPC response \(error\.code must be a number\)/,
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

test("runOneShotMcpRequest times out, includes the method and timeout, and reaps the child", async () => {
  const neverRespondServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }));
  }
});
setInterval(() => {}, 1000);
`;
  const { tracking, options } = trackProcessOptions();

  await assert.rejects(
    runOneShotMcpRequest(
      { command: process.execPath, args: ["-e", neverRespondServer], source: "node no-response server" },
      "tools/list",
      undefined,
      { ...options, timeoutMs: 100 },
    ),
    /Timed out waiting for MCP tools\/list after 100ms/,
  );

  assertProcessFinished(tracking);
});

test("runOneShotMcpRequest reports an early server exit with stderr and reaps the child", async () => {
  const earlyExitServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }));
  } else if (message.id !== undefined) {
    process.stderr.write("fatal: fake StudioMCP shutdown");
    setTimeout(() => process.exit(17), 50);
  }
});
`;
  const { tracking, options } = trackProcessOptions();

  await assert.rejects(
    runOneShotMcpRequest(
      { command: process.execPath, args: ["-e", earlyExitServer], source: "node early-exit server" },
      "tools/list",
      undefined,
      { ...options, timeoutMs: 1000 },
    ),
    /StudioMCP exited before response \(code=17, signal=null\)\. fatal: fake StudioMCP shutdown/,
  );

  assertProcessFinished(tracking);
});

test("runOneShotMcpRequest bounds stdio draining after the server exits", async () => {
  const inheritedStdoutServer = String.raw`
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }));
  } else if (message.method === "tools/list") {
    const helper = spawn(process.execPath, ["-e", "setTimeout(() => process.exit(0), 3000)"], {
      stdio: ["ignore", "inherit", "ignore"],
      detached: true,
    });
    helper.unref();
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { helperPid: helper.pid } }));
  }
});
`;
  const { tracking, options } = trackProcessOptions();
  const startedAt = Date.now();

  const result = await runOneShotMcpRequest(
    { command: process.execPath, args: ["-e", inheritedStdoutServer], source: "node inherited-stdout server" },
    "tools/list",
    undefined,
    { ...options, timeoutMs: 1000 },
  );

  assert.ok(Date.now() - startedAt < 750, "cleanup must not wait for inherited stdout to close");
  assert.equal(typeof result.response.result.helperPid, "number");
  const helperPid = result.response.result.helperPid;
  try {
    assert.ok(isProcessRunning(helperPid), "the helper still holds the server's stdout open");
    assertProcessFinished(tracking);
  } finally {
    if (isProcessRunning(helperPid)) {
      process.kill(helperPid);
      await waitForProcessExit(helperPid);
    }
  }
});

test("runOneShotMcpRequests fails pending requests on noisy stdout between valid responses", async () => {
  const noisyServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }));
  } else if (message.method === "first") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { ok: true } }));
  } else if (message.method === "second") {
    process.stdout.write("not-json output\n" + JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { ok: true } }) + "\n");
  }
});
`;
  const { tracking, options } = trackProcessOptions();

  await assert.rejects(
    runOneShotMcpRequests(
      { command: process.execPath, args: ["-e", noisyServer], source: "node noisy stdout server" },
      [{ method: "first" }, { method: "second" }],
      { ...options, timeoutMs: 1000 },
    ),
    /Invalid MCP JSON line: not-json output/,
  );

  assertProcessFinished(tracking);
});

test("runOneShotMcpRequest handles an already-aborted signal before sending and reaps the child", async () => {
  const neverRespondServer = String.raw`setInterval(() => {}, 1000);`;
  const controller = new AbortController();
  controller.abort();
  const { tracking, options } = trackProcessOptions();

  await assert.rejects(
    runOneShotMcpRequest(
      { command: process.execPath, args: ["-e", neverRespondServer], source: "node pre-abort server" },
      "tools/list",
      undefined,
      { ...options, signal: controller.signal, timeoutMs: 1000 },
    ),
    /MCP request aborted/,
  );

  assertProcessFinished(tracking);
});

test("runOneShotMcpRequest aborts a pending request and reaps the child", async () => {
  const controller = new AbortController();
  const pendingServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }));
  } else if (message.method === "tools/list") {
    process.stderr.write("TOOL_REQUEST_RECEIVED");
    setInterval(() => {}, 1000);
  }
});
`;
  const { tracking, options } = trackProcessOptions({
    onProcess(child) {
      child.stderr.on("data", (chunk) => {
        if (chunk.toString("utf8").includes("TOOL_REQUEST_RECEIVED")) controller.abort();
      });
    },
  });

  await assert.rejects(
    runOneShotMcpRequest(
      { command: process.execPath, args: ["-e", pendingServer], source: "node abort server" },
      "tools/list",
      undefined,
      { ...options, signal: controller.signal, timeoutMs: 1000 },
    ),
    /MCP request aborted/,
  );

  assertProcessFinished(tracking);
});

test("probeStudioMcpInitialize retains only the last 20,000 stderr characters", async () => {
  const { probeStudioMcpInitialize } = await import("../lib/stdio-mcp-client.ts");
  const cappedStderrServer = String.raw`
const readline = require("node:readline");
process.stderr.write("0123456789".repeat(3000));
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    setTimeout(() => console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })), 50);
  }
});
`;
  const { tracking, options } = trackProcessOptions();

  const result = await probeStudioMcpInitialize(
    { command: process.execPath, args: ["-e", cappedStderrServer], source: "node stderr-cap server" },
    { ...options, timeoutMs: 1000 },
  );

  assert.equal(result.ok, true);
  assert.equal(result.stderr.length, 20_000);
  assert.equal(result.stderr, "0123456789".repeat(3000).slice(-20_000));
  assertProcessFinished(tracking);
});

test("StudioMcpProcessRegistry tracks, untracks, kills only live children, and clears its set", async () => {
  const { StudioMcpProcessRegistry } = await import("../lib/stdio-mcp-client.ts");
  const makeChild = (exitCode) => ({
    exitCode,
    signalCode: null,
    killed: false,
    killCalls: 0,
    kill() {
      this.killCalls++;
      this.killed = true;
      this.signalCode = "SIGTERM";
      return true;
    },
  });
  const registry = new StudioMcpProcessRegistry();
  const live = makeChild(null);
  const exited = makeChild(0);
  const untracked = makeChild(null);

  registry.track(live);
  registry.track(live);
  registry.track(exited);
  registry.track(untracked);
  registry.untrack(untracked);
  registry.killAll();

  assert.equal(live.killCalls, 1);
  assert.equal(exited.killCalls, 0);
  assert.equal(untracked.killCalls, 0);

  live.killed = false;
  live.signalCode = null;
  registry.killAll();
  assert.equal(live.killCalls, 1, "killAll clears the registry after killing tracked children");
});
