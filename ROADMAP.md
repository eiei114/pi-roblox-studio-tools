# Roadmap

This roadmap is the durable planning context for `pi-roblox-studio-tools`.
It records the current release status, short-term priorities, known technical
debt, and a backlog of bounded maintenance **seeds** (30–90 minute micro-tasks)
that the Weekly maintenance seed planner can promote into tracked issues.

It is a living document. Update it whenever a release ships or a seed is
completed/dropped. It is **not** shipped in the npm tarball (`package.json`
`files`), so editing it never forces a consumer version bump or a
`CHANGELOG.md` entry (see `scripts/check-version-bump.mjs`).

---

## 1. Current release status

| Field | Value |
|---|---|
| Package | `pi-roblox-studio-tools` |
| `package.json` version | `0.3.0` |
| Latest GitHub release | [`v0.3.0`](https://github.com/eiei114/pi-roblox-studio-tools/releases/tag/v0.3.0) (2026-09-03) |
| npm `latest` | `0.3.0` |
| Release mechanism | npm Trusted Publishing (OIDC) via `auto-release.yml` → `publish.yml` |
| Open PRs | [#42](https://github.com/eiei114/pi-roblox-studio-tools/pull/42) dependabot dev-dep bump |
| Open GitHub issues | none |

### Publish-history note

`0.2.3` and `0.2.4` never landed on npm (E404 on publish). The Trusted
Publishing handoff was realigned to the `pi-extension-template` contract in
`0.2.5`, which is why npm jumps from `0.2.2` straight to `0.2.5`. The
`CHANGELOG.md` still documents the intermediate versions for completeness.
See `docs/release.md` → "Incident: E404 on v0.2.4".

### What is shipped today (0.3.0)

- **Command**: `/roblox-studio-mcp-status`
- **Tools**:
  - `roblox_studio_mcp_status` (with a lightweight `initialize` probe)
  - `roblox_studio_mcp_list_tools` (read-only `tools/list` inventory, capped output)
  - `roblox_studio_mcp_list_studios` (read-only `list_roblox_studios` call only)
- **Library**:
  - `lib/studio-mcp.ts` — cross-platform StudioMCP discovery (Windows + macOS) and readiness resolution
  - `lib/stdio-mcp-client.ts` — one-shot stdio JSON-RPC client with `getClientInfo()` version sourcing
  - `lib/studio-mcp-inventory.ts` — structured inventory responses with output caps
  - `lib/client-info.ts` — reads `package.json` version for MCP `clientInfo`
- **Skill**: `skills/roblox-studio/SKILL.md`
- **CI/release**: typecheck + `node:test` + `npm pack --dry-run` +
  `publish:guard`; OIDC Trusted Publishing.

### What is intentionally deferred

- **Generic on-demand `tools/call` wrapper as a Pi tool.** The underlying
  one-shot client (`runOneShotMcpRequest`) can already send arbitrary JSON-RPC
  requests, but no `roblox_studio_mcp_call_tool` is registered. Studio mutation
  tools run without a confirmation UI, so this slice needs explicit safety
  guidance and likely an opt-in gate before shipping.

---

## 2. Short-term maintenance goals (next 1–2 releases)

These are directional, not committed dates. Each release stays small and
reversible.

### 0.3.1 — housekeeping patch (maintenance)

Goal: close small doc/code hygiene seeds without changing runtime behavior.

- Link this roadmap from `README.md` and `docs/template-checklist.md` (seed **DOC-002**).
- Collapse the redundant `formatStatus` notify ternary in `extensions/index.ts` (seed **CLEANUP-001**).
- Triage or merge the dependabot queue ([#42](https://github.com/eiei114/pi-roblox-studio-tools/pull/42)).

### 0.4.0 — gated mutation slice: `tools/call` (feature)

Goal: expose `roblox_studio_mcp_call_tool` behind explicit safety guidance.
This is **mutation** territory and lands only after the read-only inventory
tools are stable in production.

- Per-call timeouts, stderr surfacing, and clear argument vetting guidance.
- Consider an opt-in confirmation surface before widening access.
- Update Skill, README, and architecture docs with mutation boundary rules.

---

## 3. Known technical debt

Each item is small, localized, and suitable for a micro-seed.

| ID | Area | Debt | Status |
|---|---|---|---|
| TD-1 | Docs | `docs/architecture.md` + `docs/examples.md` overpromised unregistered tools | **Resolved** in 0.3.0 |
| TD-2 | Code | MCP `clientInfo.version` drifted from `package.json` | **Resolved** in 0.2.8 (`lib/client-info.ts`) |
| TD-3 | Code | `extensions/index.ts` `formatStatus` notify level: both fallback branches are `"warning"`, redundant | Open |
| TD-4 | Docs | `docs/examples.md` described unregistered call-tool flows | **Resolved** in 0.3.0 |
| TD-5 | Tests | `makeSpawnCommand` (Windows `.bat`/`.cmd` wrapping) and `pathExists` (`X_OK` → `F_OK` fallback) lack direct unit tests | Open |
| TD-6 | CI | CI runs only `ubuntu-latest`; the `cmd.exe` spawn branch is only exercised at runtime on Windows | Open |
| TD-7 | Docs | `docs/template-checklist.md` leaves several publish-time checks unchecked | Open |
| TD-8 | Docs | `ROADMAP.md` is not linked from `README.md` or the template checklist | Open |

---

## 4. Improvement areas

- **Feature surface** — ship the gated on-demand `tools/call` Pi tool (Section 2, FEAT-002). This is the remaining core value gap.
- **Documentation** — keep public docs truthful about shipped vs. planned surface; make this roadmap discoverable (DOC-002).
- **Tests** — add direct unit coverage for platform-specific spawn and filesystem helpers (TEST-001) so behavior is locked without a real Roblox install.
- **Reliability** — tighten timeout/abort coverage and surface stderr in tool results; document the `StudioMcpProcessRegistry` `session_shutdown` contract.
- **CI** — add a Windows runner to exercise the `cmd.exe` spawn path (CI-001, stretch).

---

## 5. Candidate maintenance seeds (30–90 minutes each)

Each seed is scoped to a single PR, has explicit acceptance criteria, and is
sized for one focused session. Promote any of these into a tracked issue via
the Weekly maintenance seed planner. Seeds are independent unless noted.

> Convention: a seed ID here is informal. Once promoted to an issue, reference
> the issue key and mark the seed **done** below.

| ID | Title | Est. | Depends on | Status |
|---|---|---|---|---|
| DOC-001 | Align architecture/examples docs to shipped surface | 30–45m | — | **done** (0.3.0) |
| INFRA-001 | Stop hardcoding `CLIENT_INFO.version` | 30–60m | — | **done** (0.2.8) |
| FEAT-001 | Ship read-only `roblox_studio_mcp_list_tools` + `list_studios` | 60–90m | — | **done** (0.3.0) |
| DOC-002 | Reference ROADMAP.md from README + template-checklist | 15–30m | — | Open |
| CLEANUP-001 | Collapse redundant `formatStatus` notify ternary | 15–30m | — | Open |
| TEST-001 | Unit-test `makeSpawnCommand` + `pathExists` | 30–45m | — | Open |
| TEST-002 | Add inventory cap edge-case regression tests | 30–60m | — | Open |
| DOC-003 | Refresh template-checklist for post-0.3.0 shipped state | 30–45m | — | Open |

### DOC-002 — Reference ROADMAP.md from README + template-checklist

**Why**: this roadmap should be discoverable by maintainers and the Weekly
maintenance seed planner. Without links, the file exists but is effectively
invisible.
**Scope**: add a one-line link from `README.md` ("Links" or "Package contents")
and a checklist item in `docs/template-checklist.md`.
**Acceptance criteria**:
- [ ] `README.md` links to `ROADMAP.md`.
- [ ] `docs/template-checklist.md` has a "ROADMAP.md を用意する" item.
- [ ] `npm run ci` passes.

### CLEANUP-001 — Collapse redundant `formatStatus` notify ternary

**Why**: in `extensions/index.ts`, `status.callable ? "info" : status.found ?
"warning" : "warning"` has two identical branches (TD-3).
**Scope**: simplify to the intended two-level mapping (`info` when callable,
`warning` otherwise) with a short comment.
**Acceptance criteria**:
- [ ] Notify level is `info` iff callable, else `warning`.
- [ ] No behavior change; `npm run ci` passes.

### TEST-001 — Unit-test `makeSpawnCommand` + `pathExists`

**Why**: the Windows `.bat`/`.cmd` → `cmd.exe /c` wrapping and the `X_OK` →
`F_OK` filesystem fallback are only exercised indirectly (TD-5). Lock the
contract so refactors cannot break platform-specific spawn behavior.
**Scope**: add `tests/` cases for both helpers using dependency-injected/fake
inputs (no real Roblox install, works on `ubuntu-latest`).
**Acceptance criteria**:
- [ ] `makeSpawnCommand` wraps `.bat`/`.cmd` on `win32` and passes through otherwise.
- [ ] `pathExists` returns `true`/`false` for present/absent paths.
- [ ] `npm run ci` passes on the default CI runner.

### TEST-002 — Add inventory cap edge-case regression tests

**Why**: `lib/studio-mcp-inventory.ts` caps tool names (25), descriptions
(~120 chars), inventory text (~10 KiB), and stderr (~2 KiB). A regression
could flood Pi context with unbounded StudioMCP output.
**Scope**: extend the existing fake-server test pattern to assert truncation
behavior when the mock returns oversized payloads.
**Acceptance criteria**:
- [ ] Tests cover at least one cap boundary (tool count or description length).
- [ ] Tests assert ANSI/control-character stripping still applies after truncation.
- [ ] `npm run ci` passes; no runtime behavior change unless a bug is found.

### DOC-003 — Refresh template-checklist for post-0.3.0 shipped state

**Why**: `docs/template-checklist.md` still reads like a greenfield scaffold
(many unchecked "create repository" items) even though the package is published
at 0.3.0 (TD-7). Stale checklist items confuse new maintainers.
**Scope**: mark completed items, move one-time setup steps to a "Historical"
subsection, and add ongoing maintenance items (ROADMAP refresh, dependabot triage).
**Acceptance criteria**:
- [ ] Checklist reflects the current published state without deleting useful reminders.
- [ ] At least one ongoing maintenance item is added.
- [ ] `npm run ci` passes.

> **Stretch / future** (larger than a micro-seed, listed for visibility):
> - FEAT-002 `roblox_studio_mcp_call_tool` (mutation) — gated, needs safety guidance (Section 2).
> - CI-001 add a Windows runner to the CI matrix to exercise the `cmd.exe` spawn path (TD-6).

---

## 6. How to use this roadmap

- **Promoting a seed**: create an issue, set `roadmap_project_slug =
  pi-roblox-studio-tools`, and reference the seed ID here. After merge, edit
  this file to mark the seed done and bump the "Current release status" table.
- **Releasing**: a docs-only/ROADMAP change needs no version bump. Any change
  to `extensions/`, `lib/`, `skills/`, or shipped `package.json` fields
  requires a version bump + `CHANGELOG.md` entry (`npm run version:check`
  enforces this on PRs).
- **Updating status**: when a release ships, move the old version into the
  publish-history note and refresh the "shipped today" list.
