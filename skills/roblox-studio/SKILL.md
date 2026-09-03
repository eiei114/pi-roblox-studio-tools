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

- `roblox_studio_mcp_status` locates StudioMCP and runs a lightweight initialize probe.
- `/roblox-studio-mcp-status` reports whether StudioMCP was found and whether initialize succeeded.
- `roblox_studio_mcp_list_tools` runs read-only `tools/list` and returns a capped tool inventory.
- `roblox_studio_mcp_list_studios` runs only the hard-coded read-only `list_roblox_studios` call with empty arguments.

Mutation boundary:

- Do not expose or simulate a generic `tools/call` wrapper from these inventory tools.
- Do not attempt active Studio selection or mutation-capable Studio tools without an explicit future package slice and user confirmation policy.
