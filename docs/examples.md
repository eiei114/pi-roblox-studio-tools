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

`roblox_studio_mcp_status` locates StudioMCP on Windows or macOS and runs a lightweight initialize probe without keeping an MCP process alive.

Future slices will add on-demand `tools/list` and `tools/call` wrappers. See `skills/roblox-studio/SKILL.md` for the current scope and policy.

## Agent Skill

`skills/roblox-studio/SKILL.md` tells the agent to prefer on-demand StudioMCP child processes and avoid long-running MCP registration.
