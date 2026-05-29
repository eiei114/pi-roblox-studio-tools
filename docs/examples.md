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

`roblox_studio_mcp_list_tools` starts StudioMCP, runs MCP `tools/list`, summarizes tool names, and shuts the process down.

## Agent Skill

`skills/roblox-studio/SKILL.md` tells the agent to prefer on-demand StudioMCP child processes and avoid long-running MCP registration.