# Architecture

Pi Roblox Studio Tools wraps Roblox Studio MCP as Pi-native tools.

## Goal

Avoid configuring Roblox Studio MCP as a long-running MCP server in Pi. Instead, Pi tool calls start `StudioMCP` only when needed and shut it down promptly.

## Platform commands

- Windows: `%LOCALAPPDATA%\Roblox\mcp.bat`, then `%LOCALAPPDATA%\Roblox Studio\StudioMCP.exe`
- macOS: `/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`, then `~/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`
- Linux: unsupported because Roblox Studio is unsupported

## Initial slice (shipped)

- `lib/studio-mcp.ts` resolves StudioMCP command candidates.
- `lib/stdio-mcp-client.ts` runs one-shot stdio JSON-RPC against StudioMCP.
- `extensions/index.ts` registers:
  - `/roblox-studio-mcp-status`
  - `roblox_studio_mcp_status`

## Planned

The one-shot client in `lib/stdio-mcp-client.ts` already supports `tools/list` and `tools/call` requests, but no Pi wrapper tools are registered yet. A future slice will add:

- `roblox_studio_mcp_list_tools` — read-only wrapper around `tools/list`
- `roblox_studio_mcp_call_tool` — on-demand wrapper around `tools/call` (mutation; gated behind list + safety guidance)

See `ROADMAP.md` (seeds FEAT-001 / FEAT-002) and `skills/roblox-studio/SKILL.md` for scope.

## On-demand MCP client

`lib/stdio-mcp-client.ts` implements one-shot stdio JSON-RPC:

1. Spawn StudioMCP as a child process.
2. Send MCP `initialize`.
3. Send `notifications/initialized`.
4. Send exactly one request, currently used for `tools/list` and `tools/call`.
5. Close stdin and kill after a short grace period if needed.
6. Clean up active child processes on `session_shutdown`.

Default behavior remains no persistent MCP process. Optional optimization: short TTL pool, disabled by default.