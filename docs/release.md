# Release

This package uses npm Trusted Publishing with GitHub Actions OIDC.

Do not add `NPM_TOKEN` or long-lived npm tokens to GitHub Secrets.

If `NPM_TOKEN` exists in repository secrets, delete it. This package publishes only
through npm Trusted Publishing (OIDC). CI fails if workflow files reference token
secrets.

## One-time npm setup

On npmjs.com, configure Trusted Publishing for this package:

- Publisher: GitHub Actions
- Repository: this GitHub repository
- Workflow filename: `publish.yml`

## Release and publish

Ordinary code and version-bump merges run CI only; they do not create a tag,
release, or publish an npm package. Release creation is a separate protected
action: after explicit release authorization, manually dispatch
`.github/workflows/auto-release.yml` on `main`.

The manual release workflow checks the repository version. If `v<version>` does
not exist yet, it creates the tag and GitHub Release, then explicitly dispatches
`.github/workflows/publish.yml` for that tag.

`.github/workflows/publish.yml` accepts version tags, published GitHub Releases,
or an explicit `workflow_dispatch`. These are protected release actions and are
not part of routine maintenance verification.

The workflow skips `name@version` if that exact package version already exists on npm.

## Workflow guardrail

Do not ship a new Pi OSS package or version bump with only `package.json` changes.
The repository must include the release workflow pair:

- `.github/workflows/auto-release.yml` creates `v<version>` tags and GitHub Releases only after manual dispatch on `main`.
- `.github/workflows/publish.yml` publishes to npm only from version tags, published releases, or explicit dispatch.

Important: tags or releases created by `GITHUB_TOKEN` do not reliably fan out into another workflow through normal `push.tags` or `release.published` triggers. The template keeps publishing reliable by having `auto-release.yml` explicitly dispatch `publish.yml` after creating the tag/release. If you change the release flow, keep one explicit handoff path: `workflow_dispatch` from auto-release, `repository_dispatch`, or `workflow_run` on the auto-release workflow.

## GitHub Actions requirements

- `permissions: id-token: write`
- `permissions: actions: write` on auto-release so it can dispatch `publish.yml`
- `auto-release.yml` must call `gh workflow run publish.yml --ref "$TAG" -f ref="$TAG"`, or `publish.yml` must have an equivalent explicit handoff trigger such as `workflow_run`
- GitHub-hosted runner
- Node.js 24, so the release job uses a current npm CLI for Trusted Publishing
- No `NPM_TOKEN`
- `npm publish` from the configured workflow file

## Incident: E404 on v0.2.4

- **Symptom:** GitHub Actions run `28705012358` failed at `npm publish` with
  `npm error 404 Not Found - PUT https://registry.npmjs.org/pi-roblox-studio-tools`.
  npm `latest` stayed `0.2.2`; `0.2.3`/`0.2.4` never landed.
- **Root cause:** the workflow ran without a working Trusted Publishing handoff.
  An interim fix added `NPM_TOKEN`, but Pi OSS standard is OIDC Trusted
  Publishing through `auto-release.yml` + `publish.yml`.
- **Fix (0.2.5):** align with `pi-extension-template` — OIDC only, explicit
  `publish.yml` dispatch from `auto-release.yml`, and npm Trusted Publisher
  configured for `publish.yml`.

## First release checklist

- [ ] `package.json` name is final
- [ ] `repository.url` points to the real GitHub repository
- [ ] npm Trusted Publisher is configured
- [ ] `npm run ci` passes
- [ ] `npm pack --dry-run` contains only intended files
- [ ] `CHANGELOG.md` has the release date
