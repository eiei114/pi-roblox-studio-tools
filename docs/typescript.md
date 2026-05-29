# TypeScript Notes

This package is TypeScript-first.

## Entry points

- `extensions/index.ts`: Pi extension entrypoint
- `lib/studio-mcp.ts`: shared StudioMCP discovery helpers
- `tests/*.test.mjs`: Node test runner coverage

## Rules

- Keep `strict: true`.
- Define Pi tool parameters with TypeBox.
- Keep Pi runtime packages in `peerDependencies` and `devDependencies`.
- Put non-Pi runtime dependencies in `dependencies` only when needed.
- Keep MCP process management explicit and abortable.

## Current tool

`roblox_studio_mcp_status` locates StudioMCP on Windows/macOS without spawning a persistent MCP server.