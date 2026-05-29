import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { resolveStudioMcpCommand } from "../lib/studio-mcp.ts";
import { runOneShotMcpRequest, StudioMcpProcessRegistry } from "../lib/stdio-mcp-client.ts";

const statusParameters = Type.Object({
  verbose: Type.Optional(Type.Boolean({ description: "Include all checked candidate paths." })),
});

const listToolsParameters = Type.Object({
  timeoutMs: Type.Optional(Type.Number({ description: "Maximum milliseconds to wait for StudioMCP responses. Default: 5000." })),
  includeSchemas: Type.Optional(Type.Boolean({ description: "Include full tool schemas in the text output. Default: false." })),
});

const callToolParameters = Type.Object({
  name: Type.String({ description: "StudioMCP tool name to call, e.g. script_read, execute_luau, inspect_instance." }),
  arguments: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "Arguments object passed to the StudioMCP tool." })),
  timeoutMs: Type.Optional(Type.Number({ description: "Maximum milliseconds to wait for StudioMCP responses. Default: 5000." })),
});

function firstLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.split(/\r?\n/, 1)[0] ?? "";
}

function truncateText(value: string, maxChars = 30_000): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[truncated ${value.length - maxChars} chars]`;
}

function formatUnknownJson(value: unknown): string {
  return truncateText(JSON.stringify(value, null, 2));
}

function formatMcpToolResult(result: unknown): string {
  if (typeof result !== "object" || result === null || !("content" in result) || !Array.isArray(result.content)) {
    return formatUnknownJson(result);
  }

  const lines: string[] = [];
  for (const item of result.content) {
    if (typeof item !== "object" || item === null) {
      lines.push(String(item));
      continue;
    }

    const record = item as { type?: unknown; text?: unknown; data?: unknown; mimeType?: unknown };
    if (record.type === "text" && typeof record.text === "string") {
      lines.push(record.text);
      continue;
    }

    lines.push(JSON.stringify(record, null, 2));
  }

  return truncateText(lines.join("\n"));
}

function formatToolsList(result: unknown, includeSchemas = false): string {
  if (includeSchemas) return formatUnknownJson(result);

  if (typeof result !== "object" || result === null || !("tools" in result) || !Array.isArray(result.tools)) {
    return formatUnknownJson(result);
  }

  const lines = [`${result.tools.length} Roblox Studio MCP tools:`];
  for (const tool of result.tools) {
    if (typeof tool !== "object" || tool === null || !("name" in tool)) continue;
    const record = tool as { name?: unknown; description?: unknown; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean } };
    const flags = [];
    if (record.annotations?.readOnlyHint) flags.push("read-only");
    if (record.annotations?.destructiveHint) flags.push("destructive");
    const suffix = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
    const description = firstLine(record.description);
    lines.push(`- ${String(record.name)}${suffix}${description ? ` — ${description}` : ""}`);
  }

  return lines.join("\n");
}

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
  const processes = new StudioMcpProcessRegistry();

  pi.on("session_shutdown", async () => {
    processes.killAll();
  });

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

  pi.registerTool({
    name: "roblox_studio_mcp_list_tools",
    label: "Roblox Studio MCP List Tools",
    description: "Start StudioMCP on demand, list available MCP tools, then shut the process down.",
    promptSnippet: "roblox_studio_mcp_list_tools: start StudioMCP on demand, list available Roblox Studio MCP tools, then stop it",
    promptGuidelines: [
      "Use roblox_studio_mcp_list_tools to inspect available Roblox Studio MCP tools without registering a persistent MCP server.",
      "Use roblox_studio_mcp_status first if StudioMCP may not be installed.",
    ],
    parameters: listToolsParameters,
    async execute(_toolCallId, params, signal) {
      const status = await resolveStudioMcpCommand();
      if (!status.command) throw new Error(formatStatus(status, true));

      const result = await runOneShotMcpRequest(status.command, "tools/list", undefined, {
        timeoutMs: params.timeoutMs,
        signal,
        onProcess: (child) => processes.track(child),
        onProcessExit: (child) => processes.untrack(child),
      });

      return {
        content: [{ type: "text", text: formatToolsList(result.response.result, params.includeSchemas ?? false) }],
        details: { result: result.response.result, stderr: result.stderr },
      };
    },
  });

  pi.registerTool({
    name: "roblox_studio_mcp_call_tool",
    label: "Roblox Studio MCP Call Tool",
    description: "Start StudioMCP on demand, call any available StudioMCP tool with arguments, then shut the process down. No confirmation UI is shown.",
    promptSnippet: "roblox_studio_mcp_call_tool: start StudioMCP on demand, call any Roblox Studio MCP tool with arguments, then stop it",
    promptGuidelines: [
      "Use roblox_studio_mcp_call_tool to execute Roblox Studio MCP tools by name when the user asks for Studio inspection or modification.",
      "Use roblox_studio_mcp_list_tools first when unsure about available StudioMCP tool names or schemas.",
      "roblox_studio_mcp_call_tool does not ask for confirmation, so choose StudioMCP tool names and arguments carefully.",
    ],
    parameters: callToolParameters,
    async execute(_toolCallId, params, signal) {
      const status = await resolveStudioMcpCommand();
      if (!status.command) throw new Error(formatStatus(status, true));

      const result = await runOneShotMcpRequest(status.command, "tools/call", {
        name: params.name,
        arguments: params.arguments ?? {},
      }, {
        timeoutMs: params.timeoutMs,
        signal,
        onProcess: (child) => processes.track(child),
        onProcessExit: (child) => processes.untrack(child),
      });

      return {
        content: [{ type: "text", text: formatMcpToolResult(result.response.result) }],
        details: { result: result.response.result, stderr: result.stderr },
      };
    },
  });
}