import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type SupportedPlatform = "win32" | "darwin";

export interface StudioMcpCommand {
  command: string;
  args: string[];
  source: string;
}

export interface StudioMcpStatus {
  supported: boolean;
  platform: NodeJS.Platform;
  found: boolean;
  command?: StudioMcpCommand;
  checked: string[];
  message: string;
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

export async function resolveStudioMcpCommand(options: {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exists?: (path: string) => Promise<boolean>;
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
      checked,
      message: "Roblox Studio MCP is supported on Windows and macOS only.",
    };
  }

  for (const candidate of candidates) {
    if (await exists(candidate.command)) {
      return {
        supported: true,
        platform,
        found: true,
        command: candidate,
        checked,
        message: `Found Roblox Studio MCP at ${candidate.command}`,
      };
    }
  }

  return {
    supported: true,
    platform,
    found: false,
    checked,
    message: "Roblox Studio MCP command was not found. Install or update Roblox Studio.",
  };
}
