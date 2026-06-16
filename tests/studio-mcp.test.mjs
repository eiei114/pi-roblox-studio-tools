import assert from "node:assert/strict";
import test from "node:test";

const { getStudioMcpCandidates, resolveStudioMcpCommand } = await import("../lib/studio-mcp.ts");

test("windows candidates include Roblox mcp.bat", () => {
  const candidates = getStudioMcpCandidates("win32", { LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local" });
  assert.equal(candidates[0].command, "C:\\Users\\Test\\AppData\\Local\\Roblox\\mcp.bat");
});

test("macOS candidates include RobloxStudio.app StudioMCP", () => {
  const candidates = getStudioMcpCandidates("darwin", {});
  assert.equal(candidates[0].command, "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP");
});

test("unsupported platforms are reported", async () => {
  const status = await resolveStudioMcpCommand({ platform: "linux", exists: async () => false });
  assert.equal(status.supported, false);
  assert.equal(status.found, false);
  assert.equal(status.readiness, "unsupported");
});

test("resolver returns first existing candidate when initialize succeeds", async () => {
  const status = await resolveStudioMcpCommand({
    platform: "win32",
    env: { LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local" },
    exists: async (path) => path.endsWith("mcp.bat"),
    probe: async () => ({ ok: true }),
  });

  assert.equal(status.supported, true);
  assert.equal(status.found, true);
  assert.equal(status.callable, true);
  assert.equal(status.readiness, "callable");
  assert.equal(status.command?.command, "C:\\Users\\Test\\AppData\\Local\\Roblox\\mcp.bat");
});

test("resolver distinguishes missing binary from failed initialize probe", async () => {
  const missing = await resolveStudioMcpCommand({
    platform: "win32",
    env: { LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local" },
    exists: async () => false,
  });

  assert.equal(missing.readiness, "not_found");
  assert.match(missing.message, /not found/i);

  const notCallable = await resolveStudioMcpCommand({
    platform: "win32",
    env: { LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local" },
    exists: async (path) => path.endsWith("mcp.bat"),
    probe: async () => ({ ok: false, error: "Timed out waiting for MCP initialize after 5000ms" }),
  });

  assert.equal(notCallable.readiness, "found_not_callable");
  assert.equal(notCallable.found, true);
  assert.equal(notCallable.callable, false);
  assert.match(notCallable.message, /did not respond to initialize/i);
  assert.equal(notCallable.probeError, "Timed out waiting for MCP initialize after 5000ms");
});
