# Examples

## Extension command

`extensions/index.ts` registers:

- `/roblox-studio-mcp-status`

Try locally:

```bash
pi -e .
```

Then run:

```txt
/roblox-studio-mcp-status
```

## Custom tools

`extensions/index.ts` currently registers:

- `roblox_studio_mcp_status`
- `roblox_studio_mcp_list_tools`
- `roblox_studio_mcp_list_studios`

`roblox_studio_mcp_status` locates StudioMCP on Windows or macOS and runs a lightweight initialize probe without keeping an MCP process alive.

`roblox_studio_mcp_list_tools` runs one-shot `tools/list` and returns a capped tool inventory when StudioMCP is callable.

`roblox_studio_mcp_list_studios` runs one read-only `list_roblox_studios` call with empty arguments and returns a capped Studio instance inventory plus setup guidance when no instances are open.

These inventory tools do not expose generic `tools/call` or mutation wrappers. See `skills/roblox-studio/SKILL.md` for the current scope and policy.

## Agent Skill

`skills/roblox-studio/SKILL.md` tells the agent to prefer on-demand StudioMCP child processes and avoid long-running MCP registration.
