---
name: roblox-studio
description: Use when working with Roblox Studio MCP through Pi without a persistent MCP server.
---

# Roblox Studio MCP

Use the `roblox_studio_mcp_status` tool first when the user wants to connect Pi to Roblox Studio MCP.

Core policy:

- Do not register a long-running MCP server just to inspect Roblox Studio.
- Prefer on-demand StudioMCP child processes that shut down after each operation.
- Support Windows and macOS paths.
- Treat Linux as unsupported because Roblox Studio is not supported there.

Current package state:

- `roblox_studio_mcp_status` locates StudioMCP.
- `roblox_studio_mcp_list_tools` spawns StudioMCP on demand, runs `tools/list`, then shuts the process down.
- `roblox_studio_mcp_call_tool` spawns StudioMCP on demand, optionally runs `set_active_studio` via `activeStudioId`, runs any `tools/call`, then shuts the process down. It does not ask for confirmation.
- Future convenience tools should still spawn StudioMCP only for the duration of one MCP request or a short TTL window.
