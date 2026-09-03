# Architecture

Pi Roblox Studio Tools wraps Roblox Studio MCP as Pi-native tools.

## Goal

Avoid configuring Roblox Studio MCP as a long-running MCP server in Pi. Instead, Pi tool calls start `StudioMCP` only when needed and shut it down promptly.

## Platform commands

- Windows: `%LOCALAPPDATA%\Roblox\mcp.bat`, then `%LOCALAPPDATA%\Roblox Studio\StudioMCP.exe`
- macOS: `/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`, then `~/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`
- Linux: unsupported because Roblox Studio is unsupported

## Shipped slices

- `lib/studio-mcp.ts` resolves StudioMCP command candidates.
- `lib/stdio-mcp-client.ts` runs one-shot stdio JSON-RPC against StudioMCP.
- `lib/studio-mcp-inventory.ts` formats read-only inventory responses with output caps.
- `extensions/index.ts` registers:
  - `/roblox-studio-mcp-status`
  - `roblox_studio_mcp_status`
  - `roblox_studio_mcp_list_tools`
  - `roblox_studio_mcp_list_studios`

## Read-only inventory boundary

The inventory tools are intentionally narrow:

- `roblox_studio_mcp_list_tools` wraps `tools/list` only.
- `roblox_studio_mcp_list_studios` wraps one hard-coded read-only call: `{ name: "list_roblox_studios", arguments: {} }`.
- Unsupported platform, missing StudioMCP command, and not-callable readiness states return guidance without spawning a new inventory request.
- Output is capped: 25 tools, ~120-character descriptions, ~10 KiB Studio inventory text, and ~2 KiB stderr excerpts, with ANSI/control characters stripped.

There is no generic `roblox_studio_mcp_call_tool`, no user-specified `tools/call`, and no active Studio selection or mutation wrapper in this package slice.

## Planned

A future slice may add a gated mutation wrapper around `tools/call`. See `ROADMAP.md` (FEAT-002) and `skills/roblox-studio/SKILL.md` for scope.

## On-demand MCP client

`lib/stdio-mcp-client.ts` implements one-shot stdio JSON-RPC:

1. Spawn StudioMCP as a child process.
2. Send MCP `initialize`.
3. Send `notifications/initialized`.
4. Send exactly one request, currently used for `tools/list` and the read-only `list_roblox_studios` call.
5. Close stdin and kill after a short grace period if needed.
6. Clean up active child processes on `session_shutdown`.

Default behavior remains no persistent MCP process. Optional optimization: short TTL pool, disabled by default.
