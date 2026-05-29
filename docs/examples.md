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

## Custom tool

`extensions/index.ts` registers:

- `roblox_studio_mcp_status`

The tool locates the official Roblox Studio MCP command without starting a persistent MCP server.

Example response includes:

- platform
- supported flag
- found flag
- resolved command path
- checked candidate paths when `verbose` is true

## Agent Skill

`skills/roblox-studio/SKILL.md` tells the agent to prefer on-demand StudioMCP child processes and avoid long-running MCP registration.