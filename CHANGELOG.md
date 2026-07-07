# Changelog

## Unreleased

### Fixed

- Harden npm publish path: `.github/workflows/publish.yml` now authenticates `npm publish --provenance` with `NODE_AUTH_TOKEN` from the `NPM_TOKEN` secret. The previous tokenless "Trusted Publishing" setup caused `npm error E404 Not Found` on the registry PUT and blocked `0.2.3`/`0.2.4` from publishing. npm has no tokenless OIDC publish; `id-token: write` only signs provenance.

### Added

- Add Buy Me a Coffee sponsor button to README and native GitHub funding link via `.github/FUNDING.yml`.

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## [0.2.3] - 2026-06-26

### Changed

- README install guidance now documents project-local (`-l`), GitHub, and ephemeral `pi -e npm:` paths alongside the existing quick-start flow.
- Development guidance now documents `npm pack --dry-run` for package-readiness checks aligned with the Pi OSS template baseline.

## [0.2.2] - 2026-06-19

### Fixed

- Strengthened `assertJsonRpcSuccess` JSON-RPC validation in `lib/stdio-mcp-client.ts` (DOT-244 follow-up).

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

