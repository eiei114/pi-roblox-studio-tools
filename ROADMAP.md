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
| `package.json` version | `0.2.5` |
| Latest GitHub release | [`v0.2.5`](https://github.com/eiei114/pi-roblox-studio-tools/releases) (2026-07-07) |
| npm `latest` | `0.2.5` |
| npm published versions | `0.2.2`, `0.2.5` |
| Release mechanism | npm Trusted Publishing (OIDC) via `auto-release.yml` → `publish.yml` |
| Open PRs | [#22](https://github.com/eiei114/pi-roblox-studio-tools/pull/22) dependabot dev-dep bump |
| Open GitHub issues | none |

### Publish-history note

`0.2.3` and `0.2.4` never landed on npm (E404 on publish). The Trusted
Publishing handoff was realigned to the `pi-extension-template` contract in
`0.2.5`, which is why npm jumps from `0.2.2` straight to `0.2.5`. The
`CHANGELOG.md` still documents the intermediate versions for completeness.
See `docs/release.md` → "Incident: E404 on v0.2.4".

### What is shipped today (0.2.5)

- **Command**: `/roblox-studio-mcp-status`
- **Tool**: `roblox_studio_mcp_status` (with a lightweight `initialize` probe)
- **Library**:
  - `lib/studio-mcp.ts` — cross-platform StudioMCP discovery (Windows + macOS) and readiness resolution
  - `lib/stdio-mcp-client.ts` — one-shot stdio JSON-RPC client:
    `probeStudioMcpInitialize`, `runOneShotMcpRequest(s)`, `StudioMcpProcessRegistry`
- **Skill**: `skills/roblox-studio/SKILL.md`
- **CI/release**: typecheck + `node:test` + `npm pack --dry-run` +
  `publish:guard`; OIDC Trusted Publishing.

### What is intentionally deferred

- **Generic on-demand MCP wrappers as Pi tools.** The underlying helpers
  (`runOneShotMcpRequest` / `runOneShotMcpRequests`) exist and are tested, but
  no `roblox_studio_mcp_list_tools` / `roblox_studio_mcp_call_tool` Pi tool is
  registered yet. `CHANGELOG.md` 0.2.0 explicitly deferred this slice. This is
  the single biggest product gap and the headline feature work below.

---

## 2. Short-term maintenance goals (next 2–3 releases)

These are directional, not committed dates. Each release stays small and
reversible.

### 0.2.6 — doc/truth alignment patch (housekeeping)

Goal: make the public docs match the actually-shipped surface so the package
does not advertise tools that are not registered. No runtime behavior change.

- Sync `docs/architecture.md` and `docs/examples.md` to the shipped surface
  (seed **DOC-001**).
- Optionally back-fill the small `CLIENT_INFO` version drift (seed **INFRA-001**)
  if scoped to a read-only fix.
- Close the dependabot queue (#22) or document why it is held.

### 0.3.0 — first on-demand tool slice: `tools/list` (feature)

Goal: deliver the first piece of deferred value behind the existing,
already-tested one-shot client. List-only, read-only — no Studio mutation yet.

- Register `roblox_studio_mcp_list_tools` over `runOneShotMcpRequest("tools/list")`.
- Add TypeBox parameters, prompt snippet/guidelines, and tests.
- Update `docs/examples.md`, `README.md`, and the Skill to reflect the new tool.

### 0.3.1+ — `tools/call` (mutation) slice (feature, gated)

Goal: expose `roblox_studio_mcp_call_tool`. This is **mutation** territory, so
it lands only after `tools/list`, with explicit safety guidance (see the
README security note: Studio mutation tools run without a confirmation UI).

- Per-call timeouts, stderr surfacing, and clear argument vetting guidance.
- Consider an opt-in confirmation surface before widening access.

---

## 3. Known technical debt

Each item is small, localized, and suitable for a micro-seed.

| ID | Area | Debt |
|---|---|---|
| TD-1 | Docs | `docs/architecture.md` + `docs/examples.md` describe `roblox_studio_mcp_list_tools` / `roblox_studio_mcp_call_tool` as registered; they are not. Overpromises the shipped surface. |
| TD-2 | Code | `lib/stdio-mcp-client.ts` hardcodes `CLIENT_INFO.version = "0.2.0"`; package is `0.2.5`. MCP `initialize` `clientInfo` reports a stale version. |
| TD-3 | Code | `extensions/index.ts` `formatStatus` notify level: `status.callable ? "info" : status.found ? "warning" : "warning"` — both fallback branches are `"warning"`, redundant. |
| TD-4 | Docs | `docs/examples.md` describes a `list_roblox_studios` / `activeStudioId` flow for the unregistered call tool; reads as shipped rather than planned. |
| TD-5 | Tests | `makeSpawnCommand` (Windows `.bat`/`.cmd` → `cmd.exe /c` wrapping) and `pathExists` (`X_OK` → `F_OK` fallback) have no direct unit tests; only exercised indirectly. |
| TD-6 | CI | CI runs only `ubuntu-latest`. The package is Windows/macOS-only and the `cmd.exe` spawn branch is only exercised at runtime on Windows. |
| TD-7 | Release | `docs/template-checklist.md` leaves "LICENSE の年・名前を確認する" and several publish-time checks unchecked. |

---

## 4. Improvement areas

- **Feature surface** — ship the deferred on-demand `tools/list` then `tools/call`
  Pi tools (Section 2). This is the core value proposition of the package.
- **Documentation** — keep public docs truthful about shipped vs. planned
  surface; add a short "shipped today / planned next" section once `tools/list`
  lands.
- **Tests** — add direct unit coverage for the platform-specific spawn path and
  filesystem helpers so behavior is locked without relying on a real Roblox
  install.
- **Examples** — once `tools/list` ships, add a runnable example and expand the
  Skill guidance so the agent knows when to list vs. call.
- **Reliability** — tighten timeout/abort coverage and surface stderr in tool
  results; document the `StudioMcpProcessRegistry` `session_shutdown` contract.

---

## 5. Candidate maintenance seeds (30–90 minutes each)

Each seed is scoped to a single PR, has explicit acceptance criteria, and is
sized for one focused session. Promote any of these into a tracked issue via
the Weekly maintenance seed planner. Seeds are independent unless noted.

> Convention: a seed ID here is informal. Once promoted to an issue, reference
> the issue key and mark the seed **done** below.

| ID | Title | Est. | Depends on |
|---|---|---|---|
| DOC-001 | Align architecture/examples docs to shipped surface | 30–45m | — |
| INFRA-001 | Stop hardcoding `CLIENT_INFO.version` | 30–60m | — |
| TEST-001 | Unit-test `makeSpawnCommand` + `pathExists` | 30–45m | — |
| CLEANUP-001 | Collapse redundant `formatStatus` notify ternary | 15–30m | — |
| DOC-002 | Reference ROADMAP.md from README + template-checklist | 15–30m | — |
| FEAT-001 | Ship read-only `roblox_studio_mcp_list_tools` tool | 60–90m | — |

### DOC-001 — Align architecture/examples docs to shipped surface
**Why**: `docs/architecture.md` and `docs/examples.md` list
`roblox_studio_mcp_list_tools` / `roblox_studio_mcp_call_tool` as registered,
but `extensions/index.ts` only registers the status command + tool. Consumers
hit dead ends.
**Scope**: rewrite the affected sections to describe only the shipped surface;
move the `tools/list` + `tools/call` descriptions to a clearly-labeled
"Planned" subsection.
**Acceptance criteria**:
- [ ] No doc claims a Pi tool/command that is not registered in `extensions/index.ts`.
- [ ] `docs/architecture.md` "Initial slice" lists exactly the registered surface.
- [ ] Deferred wrappers appear only under a "Planned" heading.
- [ ] `npm run ci` passes; no runtime change.

### INFRA-001 — Stop hardcoding `CLIENT_INFO.version`
**Why**: `lib/stdio-mcp-client.ts` sends `clientInfo.version: "0.2.0"` in every
MCP `initialize`; the package is `0.2.5`. Drift will recur on every release.
**Scope**: source the version from `package.json` (read once, cached) instead
of a literal, without adding a runtime file dependency to the published
surface that breaks `npm pack`.
**Acceptance criteria**:
- [ ] MCP `initialize` `clientInfo.version` equals the current `package.json` version.
- [ ] New unit test asserts the reported version matches `package.json`.
- [ ] `npm run ci` + `npm pack --dry-run` pass; no new unintended file in the tarball.

### TEST-001 — Unit-test `makeSpawnCommand` + `pathExists`
**Why**: the Windows `.bat`/`.cmd` → `cmd.exe /c` wrapping and the `X_OK` →
`F_OK` filesystem fallback are only exercised indirectly. Lock the contract.
**Scope**: add `tests/` cases for both helpers using dependency-injected/fake
inputs (no real Roblox install, works on `ubuntu-latest`).
**Acceptance criteria**:
- [ ] `makeSpawnCommand` wraps `.bat`/`.cmd` on `win32` and passes through otherwise.
- [ ] `pathExists` returns `true`/`false` for present/absent paths.
- [ ] `npm run ci` passes on the default CI runner.

### CLEANUP-001 — Collapse redundant `formatStatus` notify ternary
**Why**: in `extensions/index.ts`, `status.callable ? "info" : status.found ?
"warning" : "warning"` has two identical branches.
**Scope**: simplify to the intended two-level mapping (`info` when callable,
`warning` otherwise) with a short comment.
**Acceptance criteria**:
- [ ] Notify level is `info` iff callable, else `warning`.
- [ ] No behavior change; `npm run ci` passes.

### DOC-002 — Reference ROADMAP.md from README + template-checklist
**Why**: this roadmap should be discoverable. Add a one-line link from
`README.md` ("Package contents" / "Links") and a checklist item in
`docs/template-checklist.md`.
**Acceptance criteria**:
- [ ] `README.md` links to `ROADMAP.md`.
- [ ] `docs/template-checklist.md` has a "ROADMAP.md を用意する" item.
- [ ] `npm run ci` passes.

### FEAT-001 — Ship read-only `roblox_studio_mcp_list_tools` tool
**Why**: first slice of the deferred on-demand value. Read-only, safe to ship
before mutation. Builds on the already-tested `runOneShotMcpRequest`.
**Scope**: register `roblox_studio_mcp_list_tools` (TypeBox params, prompt
snippet/guidelines) that runs `tools/list` via the one-shot client and returns
a summarized tool list; add tests using the existing fake-server pattern.
**Acceptance criteria**:
- [ ] `roblox_studio_mcp_list_tools` appears in `extensions/index.ts` and is covered by a test.
- [ ] Tool spawns StudioMCP, lists tools, and shuts the process down (no persistent server).
- [ ] `README.md`, `docs/examples.md`, `docs/architecture.md`, and the Skill reflect the new tool.
- [ ] `npm run ci` passes; appropriate version bump + `CHANGELOG.md` entry (this **is** a publishable change).

> **Stretch / future** (larger than a micro-seed, listed for visibility):
> - FEAT-002 `roblox_studio_mcp_call_tool` (mutation) — gated behind FEAT-001, needs safety guidance.
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
