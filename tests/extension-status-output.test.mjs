import assert from "node:assert/strict";
import test from "node:test";
import extension from "../extensions/index.ts";

function createPi() {
  const commands = new Map();
  const tools = new Map();

  return {
    commands,
    tools,
    registerCommand(name, registration) {
      commands.set(name, registration);
    },
    registerTool(registration) {
      tools.set(registration.name, registration);
    },
  };
}

function registerExtension(dependencies = {}) {
  const pi = createPi();
  extension(pi, dependencies);
  return pi;
}

const checked = ["C:\\Roblox\\StudioMCP.exe", "C:\\Roblox\\mcp.bat"];

const statuses = [
  {
    name: "not found",
    status: {
      message:
        "Roblox Studio MCP command was not found. Install or update Roblox Studio, then run /roblox-studio-mcp-status again.",
      platform: "win32",
      supported: true,
      found: false,
      callable: false,
      readiness: "not_found",
      checked,
    },
    concise:
      "Roblox Studio MCP command was not found. Install or update Roblox Studio, then run /roblox-studio-mcp-status again.\nplatform: win32\nsupported: true\nfound: false\ncallable: false\nreadiness: not_found",
    verbose:
      "Roblox Studio MCP command was not found. Install or update Roblox Studio, then run /roblox-studio-mcp-status again.\nplatform: win32\nsupported: true\nfound: false\ncallable: false\nreadiness: not_found\nchecked:\n- C:\\Roblox\\StudioMCP.exe\n- C:\\Roblox\\mcp.bat",
  },
  {
    name: "found but not callable",
    status: {
      message:
        "Roblox Studio MCP was found at C:\\Roblox\\StudioMCP.exe but did not respond to initialize. Open Roblox Studio, ensure the MCP bridge is enabled, then retry.",
      platform: "win32",
      supported: true,
      found: true,
      callable: false,
      readiness: "found_not_callable",
      command: {
        command: "C:\\Roblox\\StudioMCP.exe",
        args: [],
        source: "%LOCALAPPDATA%\\Roblox Studio\\StudioMCP.exe",
      },
      checked,
      probeError: "initialize timed out",
    },
    concise:
      "Roblox Studio MCP was found at C:\\Roblox\\StudioMCP.exe but did not respond to initialize. Open Roblox Studio, ensure the MCP bridge is enabled, then retry.\nplatform: win32\nsupported: true\nfound: true\ncallable: false\nreadiness: found_not_callable\ncommand: C:\\Roblox\\StudioMCP.exe\nsource: %LOCALAPPDATA%\\Roblox Studio\\StudioMCP.exe\nprobeError: initialize timed out",
    verbose:
      "Roblox Studio MCP was found at C:\\Roblox\\StudioMCP.exe but did not respond to initialize. Open Roblox Studio, ensure the MCP bridge is enabled, then retry.\nplatform: win32\nsupported: true\nfound: true\ncallable: false\nreadiness: found_not_callable\ncommand: C:\\Roblox\\StudioMCP.exe\nsource: %LOCALAPPDATA%\\Roblox Studio\\StudioMCP.exe\nprobeError: initialize timed out\nchecked:\n- C:\\Roblox\\StudioMCP.exe\n- C:\\Roblox\\mcp.bat",
  },
  {
    name: "callable",
    status: {
      message: "Roblox Studio MCP was found at C:\\Roblox\\mcp.bat and responds to initialize.",
      platform: "win32",
      supported: true,
      found: true,
      callable: true,
      readiness: "callable",
      command: {
        command: "C:\\Roblox\\mcp.bat",
        args: [],
        source: "%LOCALAPPDATA%\\Roblox\\mcp.bat",
      },
      checked,
    },
    concise:
      "Roblox Studio MCP was found at C:\\Roblox\\mcp.bat and responds to initialize.\nplatform: win32\nsupported: true\nfound: true\ncallable: true\nreadiness: callable\ncommand: C:\\Roblox\\mcp.bat\nsource: %LOCALAPPDATA%\\Roblox\\mcp.bat",
    verbose:
      "Roblox Studio MCP was found at C:\\Roblox\\mcp.bat and responds to initialize.\nplatform: win32\nsupported: true\nfound: true\ncallable: true\nreadiness: callable\ncommand: C:\\Roblox\\mcp.bat\nsource: %LOCALAPPDATA%\\Roblox\\mcp.bat\nchecked:\n- C:\\Roblox\\StudioMCP.exe\n- C:\\Roblox\\mcp.bat",
  },
];

test("status tool formats all readiness states exactly with verbose on and off", async (t) => {
  for (const fixture of statuses) {
    await t.test(fixture.name, async () => {
      const pi = registerExtension({ resolveStatus: async () => fixture.status });
      const tool = pi.tools.get("roblox_studio_mcp_status");

      for (const [verbose, expected] of [[false, fixture.concise], [true, fixture.verbose]]) {
        const result = await tool.execute("test-call", { verbose });
        assert.deepEqual(result.content, [{ type: "text", text: expected }]);
        assert.equal(result.details, fixture.status);
      }
    });
  }
});

test("status command always notifies verbose output at the callable-dependent level", async (t) => {
  for (const fixture of statuses) {
    await t.test(fixture.name, async () => {
      const pi = registerExtension({ resolveStatus: async () => fixture.status });
      const notifications = [];
      const command = pi.commands.get("roblox-studio-mcp-status");

      await command.handler("", { ui: { notify: (...args) => notifications.push(args) } });

      assert.deepEqual(notifications, [[fixture.verbose, fixture.status.callable ? "info" : "warning"]]);
    });
  }
});

test("inventory tools pass text and details through from their results", async () => {
  const toolsResult = { text: "Exact tools inventory output", details: { toolCount: 3, marker: "tools" } };
  const studiosResult = { text: "Exact studios inventory output", details: { studioCount: 2, marker: "studios" } };
  const pi = registerExtension({
    listTools: async () => toolsResult,
    listStudios: async () => studiosResult,
  });

  const toolsOutput = await pi.tools.get("roblox_studio_mcp_list_tools").execute("tools-call", {});
  assert.deepEqual(toolsOutput.content, [{ type: "text", text: "Exact tools inventory output" }]);
  assert.equal(toolsOutput.details, toolsResult.details);

  const studiosOutput = await pi.tools.get("roblox_studio_mcp_list_studios").execute("studios-call", {});
  assert.deepEqual(studiosOutput.content, [{ type: "text", text: "Exact studios inventory output" }]);
  assert.equal(studiosOutput.details, studiosResult.details);
});
