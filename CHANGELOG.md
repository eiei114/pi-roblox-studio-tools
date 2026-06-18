# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## [0.2.1] - 2026-06-18

### Fixed

- Hardened the version-bump guard against unsafe `BASE_REF` values by validating refs and invoking Git without a shell.
- Tightened StudioMCP JSON-RPC response validation in `lib/stdio-mcp-client.ts` (`assertJsonRpcSuccess`) so malformed success and error payloads are rejected before resolving requests.
- Reordered `CHANGELOG.md` to reverse chronological order.
- Aligned `scripts/check-version-bump.mjs` `BASE_REF` validation error output with `version:check` conventions.

## [0.2.0] - 2026-06-17

### Added

- StudioMCP status now runs a lightweight initialize probe and reports `callable` / `readiness`.
- Status messages distinguish missing StudioMCP from installed-but-not-callable environments.

### Changed

- First public slice exposes only `/roblox-studio-mcp-status` and `roblox_studio_mcp_status`.
- Generic on-demand `tools/list` and `tools/call` wrappers are deferred to later slices.

### Chores

- Added `version:check` PR guard support: package script + `scripts/check-version-bump.mjs`.
- Added CI verification that publishable changes must bump `package.json` and update `CHANGELOG.md` in the same PR.

## [0.1.0] - 2026-05-29

### Added

- Scaffolded TypeScript-first Pi package for Roblox Studio MCP.
- Added Windows/macOS StudioMCP discovery helper.
- Added `/roblox-studio-mcp-status` command.
- Added `roblox_studio_mcp_status` Pi tool.
- Added Roblox Studio MCP Agent Skill guidance.
- Added CI, npm pack check, and Trusted Publishing-ready workflow from template.
