import { runOneShotMcpRequest } from "./stdio-mcp-client.ts";
import { resolveStudioMcpCommand, type StudioMcpReadiness, type StudioMcpStatus } from "./studio-mcp.ts";

export const MAX_TOOL_ENTRIES = 25;
export const MAX_TOOL_DESCRIPTION_CHARS = 120;
export const MAX_STUDIO_TEXT_BYTES = 10 * 1024;
export const MAX_STDERR_BYTES = 2 * 1024;

export interface InventoryBaseDetails {
  readiness: StudioMcpReadiness;
  commandSource?: string;
  supported: boolean;
  platform: NodeJS.Platform;
  found: boolean;
  callable: boolean;
  stderrExcerpt?: string;
  error?: string;
  mcpError?: { code: number; message: string; data?: unknown };
}

export interface InventoryToolEntry {
  name: string;
  description: string;
}

export interface ListToolsDetails extends InventoryBaseDetails {
  toolCount?: number;
  tools?: InventoryToolEntry[];
  truncated?: boolean;
}

export interface ListStudiosDetails extends InventoryBaseDetails {
  studioCount?: number;
  rawExcerpt?: string;
  truncated?: boolean;
}

export interface InventoryResult<TDetails extends InventoryBaseDetails> {
  text: string;
  details: TDetails;
}

const ANSI_PATTERN = /\u001B\[[0-9;]*[A-Za-z]/g;
const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function sanitizeText(value: string): string {
  return value.replace(ANSI_PATTERN, "").replace(CONTROL_CHARS_PATTERN, "");
}

export function capText(value: string, maxBytes: number): { text: string; truncated: boolean } {
  const sanitized = sanitizeText(value);
  const bytes = Buffer.byteLength(sanitized, "utf8");
  if (bytes <= maxBytes) return { text: sanitized, truncated: false };

  let truncated = sanitized;
  while (Buffer.byteLength(truncated, "utf8") > maxBytes - 3) {
    truncated = truncated.slice(0, Math.max(0, truncated.length - 64));
  }
  return { text: `${truncated}...`, truncated: true };
}

export function capStderr(stderr: string): { excerpt: string; truncated: boolean } {
  const capped = capText(stderr, MAX_STDERR_BYTES);
  return { excerpt: capped.text, truncated: capped.truncated };
}

function baseDetailsFromStatus(status: StudioMcpStatus): InventoryBaseDetails {
  return {
    readiness: status.readiness,
    commandSource: status.command?.source,
    supported: status.supported,
    platform: status.platform,
    found: status.found,
    callable: status.callable,
  };
}

function readinessGuidance(status: StudioMcpStatus): string {
  if (status.readiness === "unsupported") {
    return "Roblox Studio MCP inventory is supported on Windows and macOS only.";
  }
  if (status.readiness === "not_found") {
    return "Install or update Roblox Studio, then run roblox_studio_mcp_status before listing tools or Studio instances.";
  }
  if (status.readiness === "found_not_callable") {
    return "StudioMCP was found but is not callable. Open Roblox Studio, enable the MCP bridge, then retry.";
  }
  return status.message;
}

function buildReadinessResult<TDetails extends InventoryBaseDetails>(
  status: StudioMcpStatus,
  details: TDetails,
): InventoryResult<TDetails> {
  const lines = [readinessGuidance(status), `readiness: ${status.readiness}`];
  if (status.probeError) lines.push(`probeError: ${status.probeError}`);
  return { text: lines.join("\n"), details };
}

function parseMcpError(error: unknown): { code: number; message: string; data?: unknown } | undefined {
  const match = /^MCP error (-?\d+): (.+)$/.exec(error instanceof Error ? error.message : String(error));
  if (!match) return undefined;
  return { code: Number(match[1]), message: match[2] };
}

function summarizeTools(rawTools: unknown): { tools: InventoryToolEntry[]; total: number; truncated: boolean } {
  if (!Array.isArray(rawTools)) {
    throw new Error("tools/list result.tools must be an array");
  }

  const total = rawTools.length;
  const truncated = total > MAX_TOOL_ENTRIES;
  const tools: InventoryToolEntry[] = [];

  for (const entry of rawTools.slice(0, MAX_TOOL_ENTRIES)) {
    if (!isRecord(entry) || typeof entry.name !== "string") {
      throw new Error("tools/list entries must include a string name");
    }
    const description =
      typeof entry.description === "string"
        ? capText(entry.description, MAX_TOOL_DESCRIPTION_CHARS).text
        : "";
    tools.push({ name: entry.name, description });
  }

  return { tools, total, truncated };
}

function formatToolsText(details: ListToolsDetails): string {
  const lines = [`StudioMCP exposes ${details.toolCount ?? 0} tool(s).`, `readiness: ${details.readiness}`];
  if (details.commandSource) lines.push(`commandSource: ${details.commandSource}`);
  if (details.truncated) lines.push(`note: showing first ${MAX_TOOL_ENTRIES} tools`);
  if (details.stderrExcerpt) lines.push(`stderr: ${details.stderrExcerpt}`);
  if (details.tools && details.tools.length > 0) {
    lines.push("tools:");
    for (const tool of details.tools) {
      const suffix = tool.description ? ` — ${tool.description}` : "";
      lines.push(`- ${tool.name}${suffix}`);
    }
  }
  return lines.join("\n");
}

function extractToolCallText(result: unknown): string {
  if (!isRecord(result)) return "";
  const content = result.content;
  if (!Array.isArray(content)) return JSON.stringify(result);

  const parts: string[] = [];
  for (const item of content) {
    if (isRecord(item) && item.type === "text" && typeof item.text === "string") {
      parts.push(item.text);
    }
  }
  return parts.join("\n");
}

function countStudiosFromText(text: string): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed.length;
    if (isRecord(parsed)) {
      if (Array.isArray(parsed.studios)) return parsed.studios.length;
      if (Array.isArray(parsed.instances)) return parsed.instances.length;
      if (typeof parsed.count === "number") return parsed.count;
    }
  } catch {
    // Fall through to heuristic counting.
  }

  const objectMatches = trimmed.match(/\{[^{}]*\}/g);
  if (objectMatches && objectMatches.length > 0) return objectMatches.length;
  const lineMatches = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  return lineMatches.length > 0 ? lineMatches.length : undefined;
}

function formatStudiosText(details: ListStudiosDetails): string {
  const lines = [`Detected ${details.studioCount ?? 0} Roblox Studio instance(s).`, `readiness: ${details.readiness}`];
  if (details.commandSource) lines.push(`commandSource: ${details.commandSource}`);
  if (details.studioCount === 0) {
    lines.push("Open Roblox Studio and ensure the MCP bridge is connected, then retry.");
  }
  if (details.truncated) lines.push("note: Studio inventory text was truncated");
  if (details.stderrExcerpt) lines.push(`stderr: ${details.stderrExcerpt}`);
  if (details.rawExcerpt) {
    lines.push("inventory:");
    lines.push(details.rawExcerpt);
  }
  return lines.join("\n");
}

export async function listStudioMcpTools(options: {
  resolve?: typeof resolveStudioMcpCommand;
  runRequest?: typeof runOneShotMcpRequest;
  timeoutMs?: number;
} = {}): Promise<InventoryResult<ListToolsDetails>> {
  const resolve = options.resolve ?? resolveStudioMcpCommand;
  const runRequest = options.runRequest ?? runOneShotMcpRequest;
  const status = await resolve();

  const base = baseDetailsFromStatus(status);
  if (!status.callable || !status.command) {
    return buildReadinessResult(status, base as ListToolsDetails);
  }

  try {
    const result = await runRequest(status.command, "tools/list", undefined, {
      timeoutMs: options.timeoutMs ?? 5000,
    });
    const stderr = capStderr(result.stderr);
    const summary = summarizeTools(isRecord(result.response.result) ? result.response.result.tools : undefined);

    const details: ListToolsDetails = {
      ...base,
      toolCount: summary.total,
      tools: summary.tools,
      truncated: summary.truncated,
      stderrExcerpt: stderr.excerpt || undefined,
    };

    return { text: formatToolsText(details), details };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderrExcerpt = message.includes("stderr") ? capStderr(message).excerpt : undefined;
    const details: ListToolsDetails = {
      ...base,
      error: message,
      mcpError: parseMcpError(error),
      stderrExcerpt,
    };

    const lines = ["Failed to list StudioMCP tools.", `error: ${message}`, `readiness: ${status.readiness}`];
    if (details.stderrExcerpt) lines.push(`stderr: ${details.stderrExcerpt}`);
    return { text: lines.join("\n"), details };
  }
}

export async function listRobloxStudios(options: {
  resolve?: typeof resolveStudioMcpCommand;
  runRequest?: typeof runOneShotMcpRequest;
  timeoutMs?: number;
} = {}): Promise<InventoryResult<ListStudiosDetails>> {
  const resolve = options.resolve ?? resolveStudioMcpCommand;
  const runRequest = options.runRequest ?? runOneShotMcpRequest;
  const status = await resolve();

  const base = baseDetailsFromStatus(status);
  if (!status.callable || !status.command) {
    return buildReadinessResult(status, base as ListStudiosDetails);
  }

  try {
    const result = await runRequest(
      status.command,
      "tools/call",
      { name: "list_roblox_studios", arguments: {} },
      { timeoutMs: options.timeoutMs ?? 5000 },
    );

    const stderr = capStderr(result.stderr);
    const rawText = extractToolCallText(result.response.result);
    const capped = capText(rawText, MAX_STUDIO_TEXT_BYTES);
    const studioCount = countStudiosFromText(rawText);

    const details: ListStudiosDetails = {
      ...base,
      studioCount: studioCount ?? 0,
      rawExcerpt: capped.text || undefined,
      truncated: capped.truncated,
      stderrExcerpt: stderr.excerpt || undefined,
    };

    return { text: formatStudiosText(details), details };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const mcpError = parseMcpError(error);
    const isMissingTool =
      /list_roblox_studios/i.test(message) ||
      (mcpError?.code === -32601 && /not found/i.test(mcpError.message));

    const details: ListStudiosDetails = {
      ...base,
      error: message,
      mcpError,
      stderrExcerpt: capStderr(message).excerpt || undefined,
    };

    const lines = [
      isMissingTool
        ? "StudioMCP does not expose the read-only list_roblox_studios tool. Update Roblox Studio or the MCP bridge."
        : "Failed to list Roblox Studio instances.",
      `error: ${message}`,
      `readiness: ${status.readiness}`,
    ];
    if (details.stderrExcerpt) lines.push(`stderr: ${details.stderrExcerpt}`);
    return { text: lines.join("\n"), details };
  }
}
