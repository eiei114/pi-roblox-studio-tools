import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { resolveStudioMcpCommand } from "../lib/studio-mcp.ts";

const statusParameters = Type.Object({
  verbose: Type.Optional(Type.Boolean({ description: "Include all checked candidate paths." })),
});

function formatStatus(status: Awaited<ReturnType<typeof resolveStudioMcpCommand>>, verbose = false): string {
  const lines = [status.message, `platform: ${status.platform}`, `supported: ${status.supported}`, `found: ${status.found}`];

  if (status.command) {
    lines.push(`command: ${status.command.command}`);
    lines.push(`source: ${status.command.source}`);
  }

  if (verbose && status.checked.length > 0) {
    lines.push("checked:");
    for (const candidate of status.checked) lines.push(`- ${candidate}`);
  }

  return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("roblox-studio-mcp-status", {
    description: "Check whether Roblox Studio MCP can be found without starting a long-running MCP server",
    handler: async (_args, ctx) => {
      const status = await resolveStudioMcpCommand();
      const text = formatStatus(status, true);
      ctx.ui.notify(text, status.found ? "info" : "warning");
    },
  });

  pi.registerTool({
    name: "roblox_studio_mcp_status",
    label: "Roblox Studio MCP Status",
    description: "Locate the Roblox Studio MCP command on Windows or macOS without keeping an MCP process alive.",
    promptSnippet: "roblox_studio_mcp_status: locate Roblox Studio MCP on Windows/macOS without starting a persistent MCP server",
    promptGuidelines: [
      "Use roblox_studio_mcp_status before any Roblox Studio MCP action to verify that StudioMCP is installed.",
      "Do not start a persistent Roblox Studio MCP server; this package is designed for on-demand process use.",
    ],
    parameters: statusParameters,
    async execute(_toolCallId, params) {
      const status = await resolveStudioMcpCommand();
      return {
        content: [{ type: "text", text: formatStatus(status, params.verbose ?? false) }],
        details: status,
      };
    },
  });
}
