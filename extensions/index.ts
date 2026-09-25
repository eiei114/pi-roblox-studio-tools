import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { listRobloxStudios, listStudioMcpTools } from "../lib/studio-mcp-inventory.ts";
import { resolveStudioMcpCommand } from "../lib/studio-mcp.ts";

const statusParameters = Type.Object({
  verbose: Type.Optional(Type.Boolean({ description: "Include all checked candidate paths." })),
});

const inventoryParameters = Type.Object({});

function formatStatus(status: Awaited<ReturnType<typeof resolveStudioMcpCommand>>, verbose = false): string {
  const lines = [
    status.message,
    `platform: ${status.platform}`,
    `supported: ${status.supported}`,
    `found: ${status.found}`,
    `callable: ${status.callable}`,
    `readiness: ${status.readiness}`,
  ];

  if (status.command) {
    lines.push(`command: ${status.command.command}`);
    lines.push(`source: ${status.command.source}`);
  }

  if (status.probeError) {
    lines.push(`probeError: ${status.probeError}`);
  }

  if (verbose && status.checked.length > 0) {
    lines.push("checked:");
    for (const candidate of status.checked) lines.push(`- ${candidate}`);
  }

  return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("roblox-studio-mcp-status", {
    description: "Check whether Roblox Studio MCP can be found and initialized without starting a long-running MCP server",
    handler: async (_args, ctx) => {
      const status = await resolveStudioMcpCommand();
      const text = formatStatus(status, true);
      const level = status.callable ? "info" : "warning";
      ctx.ui.notify(text, level);
    },
  });

  pi.registerTool({
    name: "roblox_studio_mcp_status",
    label: "Roblox Studio MCP Status",
    description: "Locate Roblox Studio MCP on Windows or macOS and verify it responds to initialize without keeping an MCP process alive.",
    promptSnippet: "roblox_studio_mcp_status: locate Roblox Studio MCP on Windows/macOS and verify initialize without starting a persistent MCP server",
    promptGuidelines: [
      "Use roblox_studio_mcp_status before any Roblox Studio MCP action to verify that StudioMCP is installed and callable.",
      "Do not start a persistent Roblox Studio MCP server; this package is designed for on-demand process use.",
      "If readiness is found_not_callable, ask the user to open Roblox Studio before trying richer Studio tooling.",
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

  pi.registerTool({
    name: "roblox_studio_mcp_list_tools",
    label: "Roblox Studio MCP List Tools",
    description: "List StudioMCP tool names and descriptions through a one-shot tools/list request without keeping an MCP process alive.",
    promptSnippet: "roblox_studio_mcp_list_tools: read-only StudioMCP tools/list inventory with capped output",
    promptGuidelines: [
      "Use roblox_studio_mcp_list_tools after roblox_studio_mcp_status when the user wants to inspect what StudioMCP exposes.",
      "This tool is read-only and does not call mutation-capable Studio tools.",
      "Do not expose or simulate a generic tools/call wrapper from this inventory result.",
    ],
    parameters: inventoryParameters,
    async execute() {
      const result = await listStudioMcpTools();
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },
  });

  pi.registerTool({
    name: "roblox_studio_mcp_list_studios",
    label: "Roblox Studio MCP List Studios",
    description: "List open Roblox Studio instances through a one-shot read-only list_roblox_studios call without keeping an MCP process alive.",
    promptSnippet: "roblox_studio_mcp_list_studios: read-only Studio instance inventory via list_roblox_studios",
    promptGuidelines: [
      "Use roblox_studio_mcp_list_studios after roblox_studio_mcp_status when the user wants to see open Roblox Studio instances.",
      "This tool calls only the hard-coded read-only list_roblox_studios tool with empty arguments.",
      "Do not attempt active Studio selection or mutation-capable tools from this inventory flow.",
    ],
    parameters: inventoryParameters,
    async execute() {
      const result = await listRobloxStudios();
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },
  });
}
