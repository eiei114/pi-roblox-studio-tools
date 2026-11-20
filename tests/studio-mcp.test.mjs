import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const { getStudioMcpCandidates, pathExists, resolveStudioMcpCommand } = await import("../lib/studio-mcp.ts");

test("pathExists checks real temporary files and falls back when execute permission is denied", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "studio-mcp-path-exists-"));
  const existingPath = join(directory, "studio-mcp");
  const missingPath = join(directory, "missing-studio-mcp");

  try {
    await writeFile(existingPath, "temporary test executable");
    await chmod(existingPath, 0o644);

    assert.equal(await pathExists(existingPath), true);
    assert.equal(await pathExists(missingPath), false);

    try {
      await access(existingPath, constants.X_OK);
      t.diagnostic("Host filesystem does not enforce execute permission; F_OK fallback check skipped.");
    } catch (error) {
      if (error.code !== "EACCES" && error.code !== "EPERM") throw error;

      await access(existingPath, constants.F_OK);
      assert.equal(await pathExists(existingPath), true, "an existing non-executable file is found via F_OK");
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("windows candidates preserve a normalized Windows LOCALAPPDATA path", () => {
  const candidates = getStudioMcpCandidates("win32", { LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local" });

  assert.deepEqual(
    candidates.map(({ command }) => command),
    [
      "C:\\Users\\Test\\AppData\\Local\\Roblox\\mcp.bat",
      "C:\\Users\\Test\\AppData\\Local\\Roblox Studio\\StudioMCP.exe",
    ],
  );
});

test("windows candidates normalize slash-separated LOCALAPPDATA paths", () => {
  const candidates = getStudioMcpCandidates("win32", { LOCALAPPDATA: "C:/Users/Test/AppData/Local/" });

  assert.equal(candidates[0].command, "C:\\Users\\Test\\AppData\\Local\\Roblox\\mcp.bat");
  assert.equal(candidates[1].command, "C:\\Users\\Test\\AppData\\Local\\Roblox Studio\\StudioMCP.exe");
});

test("missing Windows LOCALAPPDATA produces no invalid candidates", () => {
  assert.deepEqual(getStudioMcpCandidates("win32", {}), []);
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
