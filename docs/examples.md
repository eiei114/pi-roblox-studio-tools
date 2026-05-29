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

`extensions/index.ts` registers:

- `roblox_studio_mcp_status`
- `roblox_studio_mcp_list_tools`
- `roblox_studio_mcp_call_tool`

`roblox_studio_mcp_list_tools` starts StudioMCP, runs MCP `tools/list`, summarizes tool names, and shuts the process down.

`roblox_studio_mcp_call_tool` starts StudioMCP, runs MCP `tools/call` for any tool name and arguments, then shuts the process down.

If you already have a Studio id from `list_roblox_studios`, include `activeStudioId` so `set_active_studio` and the target tool run in the same temporary StudioMCP process.

## Agent Skill

`skills/roblox-studio/SKILL.md` tells the agent to prefer on-demand StudioMCP child processes and avoid long-running MCP registration.
