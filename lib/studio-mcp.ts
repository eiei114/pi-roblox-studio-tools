import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { probeStudioMcpInitialize } from "./stdio-mcp-client.ts";

export type SupportedPlatform = "win32" | "darwin";

export type StudioMcpReadiness = "unsupported" | "not_found" | "found_not_callable" | "callable";

export interface StudioMcpCommand {
  command: string;
  args: string[];
  source: string;
}

export interface StudioMcpStatus {
  supported: boolean;
  platform: NodeJS.Platform;
  found: boolean;
  callable: boolean;
  readiness: StudioMcpReadiness;
  command?: StudioMcpCommand;
  checked: string[];
  message: string;
  probeError?: string;
}

function windowsCandidates(env: NodeJS.ProcessEnv): StudioMcpCommand[] {
  const localAppData = env.LOCALAPPDATA;
  const candidates: StudioMcpCommand[] = [];

  if (localAppData) {
    candidates.push({
      command: join(localAppData, "Roblox", "mcp.bat"),
      args: [],
      source: "%LOCALAPPDATA%\\Roblox\\mcp.bat",
    });
    candidates.push({
      command: join(localAppData, "Roblox Studio", "StudioMCP.exe"),
      args: [],
      source: "%LOCALAPPDATA%\\Roblox Studio\\StudioMCP.exe",
    });
  }

  return candidates;
}

function macCandidates(): StudioMcpCommand[] {
  return [
    {
      command: "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP",
      args: [],
      source: "/Applications/RobloxStudio.app",
    },
    {
      command: join(homedir(), "Applications", "RobloxStudio.app", "Contents", "MacOS", "StudioMCP"),
      args: [],
      source: "~/Applications/RobloxStudio.app",
    },
  ];
}

export function getStudioMcpCandidates(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): StudioMcpCommand[] {
  if (platform === "win32") return windowsCandidates(env);
  if (platform === "darwin") return macCandidates();
  return [];
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

function notFoundStatus(platform: NodeJS.Platform, checked: string[]): StudioMcpStatus {
  return {
    supported: true,
    platform,
    found: false,
    callable: false,
    readiness: "not_found",
    checked,
    message:
      "Roblox Studio MCP command was not found. Install or update Roblox Studio, then run /roblox-studio-mcp-status again.",
  };
}

function foundNotCallableStatus(
  platform: NodeJS.Platform,
  command: StudioMcpCommand,
  checked: string[],
  probeError: string,
): StudioMcpStatus {
  return {
    supported: true,
    platform,
    found: true,
    callable: false,
    readiness: "found_not_callable",
    command,
    checked,
    probeError,
    message: `Roblox Studio MCP was found at ${command.command} but did not respond to initialize. Open Roblox Studio, ensure the MCP bridge is enabled, then retry.`,
  };
}

function callableStatus(platform: NodeJS.Platform, command: StudioMcpCommand, checked: string[]): StudioMcpStatus {
  return {
    supported: true,
    platform,
    found: true,
    callable: true,
    readiness: "callable",
    command,
    checked,
    message: `Roblox Studio MCP was found at ${command.command} and responds to initialize.`,
  };
}

export async function resolveStudioMcpCommand(options: {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exists?: (path: string) => Promise<boolean>;
  probe?: (command: StudioMcpCommand) => Promise<{ ok: boolean; error?: string }>;
  probeTimeoutMs?: number;
} = {}): Promise<StudioMcpStatus> {
  const platform = options.platform ?? process.platform;
  const exists = options.exists ?? pathExists;
  const candidates = getStudioMcpCandidates(platform, options.env ?? process.env);
  const checked = candidates.map((candidate) => candidate.command);

  if (platform !== "win32" && platform !== "darwin") {
    return {
      supported: false,
      platform,
      found: false,
      callable: false,
      readiness: "unsupported",
      checked,
      message: "Roblox Studio MCP is supported on Windows and macOS only.",
    };
  }

  for (const candidate of candidates) {
    if (!(await exists(candidate.command))) continue;

    const probe =
      options.probe ??
      (async (command) => {
        const result = await probeStudioMcpInitialize(command, { timeoutMs: options.probeTimeoutMs ?? 5000 });
        return result.ok ? { ok: true } : { ok: false, error: result.error ?? "StudioMCP initialize probe failed." };
      });

    const probeResult = await probe(candidate);
    if (probeResult.ok) return callableStatus(platform, candidate, checked);

    return foundNotCallableStatus(platform, candidate, checked, probeResult.error ?? "StudioMCP initialize probe failed.");
  }

  return notFoundStatus(platform, checked);
}
