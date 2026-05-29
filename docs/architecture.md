# Architecture

Pi Roblox Studio Tools wraps Roblox Studio MCP as Pi-native tools.

## Goal

Avoid configuring Roblox Studio MCP as a long-running MCP server in Pi. Instead, Pi tool calls start `StudioMCP` only when needed and shut it down promptly.

## Platform commands

- Windows: `%LOCALAPPDATA%\Roblox\mcp.bat`, then `%LOCALAPPDATA%\Roblox Studio\StudioMCP.exe`
- macOS: `/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`, then `~/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`
- Linux: unsupported because Roblox Studio is unsupported

## Initial slice

- `lib/studio-mcp.ts` resolves StudioMCP command candidates.
- `lib/stdio-mcp-client.ts` runs one-shot stdio JSON-RPC against StudioMCP.
- `extensions/index.ts` registers `/roblox-studio-mcp-status`, `roblox_studio_mcp_status`, and `roblox_studio_mcp_list_tools`.

## On-demand MCP client

`lib/stdio-mcp-client.ts` implements one-shot stdio JSON-RPC:

1. Spawn StudioMCP as a child process.
2. Send MCP `initialize`.
3. Send `notifications/initialized`.
4. Send exactly one request, currently used for `tools/list` and `tools/call`.
5. Close stdin and kill after a short grace period if needed.
6. Clean up active child processes on `session_shutdown`.

Default behavior remains no persistent MCP process. Optional optimization: short TTL pool, disabled by default.