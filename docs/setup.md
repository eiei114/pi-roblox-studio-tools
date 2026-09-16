# Setup and verification

This guide documents the supported environment, install options, and verification
paths for Pi Roblox Studio Tools. It is the canonical reference for confirming
that StudioMCP is reachable before using the read-only inventory tools shipped
in 0.3.0.

## Supported platforms

| Platform | Supported | Notes |
|---|---|---|
| Windows | yes | Roblox Studio must be installed; StudioMCP ships with Studio |
| macOS | yes | Roblox Studio must be installed; StudioMCP ships with Studio |
| Linux | no | Roblox Studio is unsupported, so this package returns `readiness: unsupported` |

Do not register Roblox Studio MCP as a long-running MCP server in Pi. This
package spawns `StudioMCP` on demand for each tool call and shuts it down
afterward. See [`architecture.md`](architecture.md) for the on-demand client
design.

## Prerequisites

1. **Pi** installed and able to load Pi packages.
2. **Roblox Studio** installed on Windows or macOS. Studio provides the official
   `StudioMCP` command this package discovers.
3. **No npm publish credentials** are required for end-user setup — install from
   npm or GitHub as shown below.

### StudioMCP discovery paths

The package checks these candidates in order:

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

If none exist, status output reports `found: false` and `readiness: not_found`.

## Install options

Pick one install path:

```bash
# Published npm package (recommended)
pi install npm:pi-roblox-studio-tools

# Project-local install
pi install npm:pi-roblox-studio-tools -l

# GitHub source
pi install git:github.com/eiei114/pi-roblox-studio-tools

# Try without permanently installing
pi -e npm:pi-roblox-studio-tools
```

For package development from a git checkout:

```bash
git clone https://github.com/eiei114/pi-roblox-studio-tools.git
cd pi-roblox-studio-tools
npm install
pi -e .
```

## End-user verification path

Use this sequence after install. It exercises every shipped Pi command and tool
without mutation-capable `tools/call` wrappers.

### 1. Open Roblox Studio

Launch at least one Roblox Studio instance before running inventory tools.
Without an open Studio, status may report `readiness: found_not_callable`.

### 2. Check readiness

Run the Pi command or ask the agent to call the status tool:

```txt
/roblox-studio-mcp-status
```

```txt
roblox_studio_mcp_status
```

**Expected when setup is correct:**

```txt
callable: true
readiness: callable
```

The output also includes `platform`, `found`, and the resolved `command` path.
Use `roblox_studio_mcp_status` with `verbose: true` to list every checked
candidate path.

### 3. Verify read-only inventory tools

Only continue when step 2 shows `callable: true`.

```txt
roblox_studio_mcp_list_tools
roblox_studio_mcp_list_studios
```

**Expected:**

- `list_tools` returns a capped inventory of StudioMCP tool names and
  descriptions (max 25 tools, ~120-character descriptions).
- `list_studios` returns open Studio instances, or setup guidance when none are
  open.

Each call starts StudioMCP, performs one JSON-RPC request, returns capped output,
and shuts the child process down. No persistent MCP process remains.

For a copy-and-run version of steps 1–3, see
[`examples.md` → Recommended workflow](examples.md#recommended-workflow).

### Readiness troubleshooting

| `readiness` | Meaning | What to do |
|---|---|---|
| `unsupported` | Linux or other unsupported OS | Use Windows or macOS with Roblox Studio |
| `not_found` | StudioMCP command missing | Install or update Roblox Studio; confirm paths above exist |
| `found_not_callable` | StudioMCP exists but initialize failed | Open Roblox Studio, then rerun status before inventory tools |
| `callable` | Initialize probe succeeded | Proceed to inventory tools |

If inventory tools return guidance instead of data, rerun step 2. They do not
spawn StudioMCP when readiness is not `callable`.

## Maintainer verification path

Contributors and maintainers verify package changes with automated checks. This
path does not require Roblox Studio on the CI runner — tests use fakes and
fixtures where needed.

From the repository root:

```bash
npm install
npm run ci
```

`npm run ci` runs, in order:

1. `npm run typecheck` — TypeScript strict check
2. `npm test` — `node:test` suite including doc alignment tests
3. `npm run pack:check` — `npm pack --dry-run` tarball validation
4. `npm run publish:guard` — fails if workflow files reference npm tokens

Optional local Pi smoke test after `pi -e .`:

```txt
/roblox-studio-mcp-status
```

On a machine with Roblox Studio open, follow the
[end-user verification path](#end-user-verification-path) to confirm real
StudioMCP integration.

Pull requests that change shipped runtime code (`extensions/`, `lib/`, `skills/`,
or published `package.json` fields) must also bump `package.json` version and
update `CHANGELOG.md` (`npm run version:check` enforces this in CI). Docs-only
changes, including this file and `ROADMAP.md`, do not require a version bump.

## Shipped surface (0.3.0)

This package intentionally exposes read-only diagnostics only:

- Command: `/roblox-studio-mcp-status`
- Tools: `roblox_studio_mcp_status`, `roblox_studio_mcp_list_tools`,
  `roblox_studio_mcp_list_studios`

There is no generic `roblox_studio_mcp_call_tool` or mutation wrapper. See
[`architecture.md`](architecture.md) and [`skills/roblox-studio/SKILL.md`](../skills/roblox-studio/SKILL.md)
for scope and agent policy.

## Related docs

- [`examples.md`](examples.md) — copy-and-run status → inventory workflow
- [`architecture.md`](architecture.md) — on-demand MCP client and output caps
- [`release.md`](release.md) — npm Trusted Publishing and release gates
- [`ROADMAP.md`](../ROADMAP.md) — maintenance seeds and planned slices
