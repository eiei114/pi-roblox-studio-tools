# Architecture

Pi Roblox Studio Tools wraps Roblox Studio MCP as Pi-native tools.

## Goal

Avoid configuring Roblox Studio MCP as a long-running MCP server in Pi. Instead, Pi tool calls should start `StudioMCP` only when needed and shut it down promptly.

## Platform commands

- Windows: `%LOCALAPPDATA%\Roblox\mcp.bat`, then `%LOCALAPPDATA%\Roblox Studio\StudioMCP.exe`
- macOS: `/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`, then `~/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`
- Linux: unsupported because Roblox Studio is unsupported

## Initial slice

- `lib/studio-mcp.ts` resolves StudioMCP command candidates.
- `extensions/index.ts` registers `/roblox-studio-mcp-status` and `roblox_studio_mcp_status`.

## Next slice

Add a small stdio MCP client helper:

1. Spawn StudioMCP as a child process.
2. Send MCP `initialize`.
3. Send exactly one tool/list/call request.
4. Send shutdown or close stdin.
5. Kill the child if it exceeds timeout.
6. Clean up all child processes on `session_shutdown`.

Optional optimization: short TTL pool, disabled by default.
