# Pi Roblox Studio Tools

[![CI](https://github.com/eiei114/pi-roblox-studio-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/eiei114/pi-roblox-studio-tools/actions/workflows/ci.yml)
[![Publish](https://github.com/eiei114/pi-roblox-studio-tools/actions/workflows/publish.yml/badge.svg)](https://github.com/eiei114/pi-roblox-studio-tools/actions/workflows/publish.yml)
[![npm version](https://img.shields.io/npm/v/pi-roblox-studio-tools.svg)](https://www.npmjs.com/package/pi-roblox-studio-tools)
[![npm downloads](https://img.shields.io/npm/dm/pi-roblox-studio-tools.svg)](https://www.npmjs.com/package/pi-roblox-studio-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pi package](https://img.shields.io/badge/pi-package-purple.svg)](https://pi.dev/packages)
[![Trusted Publishing](https://img.shields.io/badge/npm-Trusted%20Publishing-blue.svg)](docs/release.md)
<a href="https://buymeacoffee.com/ekawano114m"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217" height="60"></a>

> On-demand Roblox Studio MCP tools for Pi without a long-running MCP server.

## What this is

Pi Roblox Studio Tools adds Pi-native tools for working with Roblox Studio MCP while avoiding an always-on MCP server process.

The package locates the official `StudioMCP` command on Windows and macOS. MCP tools spawn StudioMCP only when a Pi tool call needs it, then shut it down after the request.

## Features

- Cross-platform StudioMCP path detection for Windows and macOS
- Pi command: `/roblox-studio-mcp-status`
- Pi tool: `roblox_studio_mcp_status` with initialize probe
- Distinguishes missing StudioMCP from installed-but-not-callable states
- No persistent MCP process by default
- TypeScript-first Pi package structure

## Install

```bash
pi install npm:pi-roblox-studio-tools
```

Or install from GitHub:

```bash
pi install git:github.com/eiei114/pi-roblox-studio-tools
```

## Quick start

Try this package locally:

```bash
pi -e .
```

Then run:

```txt
/roblox-studio-mcp-status
```

The agent can also call:

```txt
roblox_studio_mcp_status
```

Status output reports whether StudioMCP was found and whether initialize succeeded.

## StudioMCP paths

Windows:

```txt
%LOCALAPPDATA%\Roblox\mcp.bat
%LOCALAPPDATA%\Roblox Studio\StudioMCP.exe
```

macOS:

```txt
/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP
~/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP
```

## Package contents

| Path | Purpose |
|---|---|
| `extensions/` | Pi TypeScript extension entrypoints |
| `lib/` | Shared StudioMCP discovery and one-shot stdio MCP client helpers |
| `skills/` | Agent Skill for Roblox Studio MCP workflow guidance |
| `docs/` | Architecture, release, and setup docs |

## Development

```bash
npm install
npm run ci
```

## Release

This package is set up for npm Trusted Publishing, so no `NPM_TOKEN` is required.

```bash
npm version patch
git push --follow-tags
```

See [`docs/release.md`](docs/release.md) for setup details.

## Security

Pi packages can execute code with your local permissions. Review extensions before installing third-party packages.

This package is designed to avoid a long-running MCP process. Studio mutation tools run without confirmation UI, so review tool names and arguments carefully.

For vulnerability reporting, see [`SECURITY.md`](SECURITY.md).

## Links

- npm: https://www.npmjs.com/package/pi-roblox-studio-tools
- GitHub: https://github.com/eiei114/pi-roblox-studio-tools
- Issues: https://github.com/eiei114/pi-roblox-studio-tools/issues

## License

MIT
