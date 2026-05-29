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
});

test("resolver returns first existing candidate", async () => {
  const status = await resolveStudioMcpCommand({
    platform: "win32",
    env: { LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local" },
    exists: async (path) => path.endsWith("mcp.bat"),
  });

  assert.equal(status.supported, true);
  assert.equal(status.found, true);
  assert.equal(status.command?.command, "C:\\Users\\Test\\AppData\\Local\\Roblox\\mcp.bat");
});
