# Release

This package publishes to npm from GitHub Actions when a `v*` tag is pushed.

Authentication uses an npm **automation token** stored in the `NPM_TOKEN`
repository secret, passed to `npm publish` as `NODE_AUTH_TOKEN`. Releases are
additionally signed with npm **provenance** (`--provenance` + `id-token: write`),
which attaches a Sigstore attestation linking the published tarball to this
GitHub Actions build.

> **npm does not support tokenless "Trusted Publishing".** The `id-token: write`
> permission only lets `--provenance` sign the release; it never authenticates
> the publish itself. An earlier version of this doc (and the scaffolding
> template) claimed no token was required — that is what broke the `v0.2.4`
> publish (see [Incident: E404 on v0.2.4](#incident-e404-on-v024) below).

## One-time setup

1. Create an npm access token (Granular Access or Classic **Automation** token)
   with publish rights for `pi-roblox-studio-tools`:
   `npmjs.com → Access Tokens → Generate New Token`.
2. Add it as a GitHub repository secret named **`NPM_TOKEN`**:
   `Settings → Secrets and variables → Actions → New repository secret`.
3. Keep the workflow `permissions: id-token: write` so `--provenance` can sign.
4. Confirm `package.json` `publishConfig.access` is `public` (already set).

`NPM_TOKEN` is a secret — it must never be committed or logged.

## Publish

```bash
npm version patch
git push --follow-tags
```

The `v*` tag triggers `.github/workflows/publish.yml`, which runs typecheck,
tests, `pack:check`, then `npm publish --provenance`.

## Incident: E404 on v0.2.4

- **Symptom:** GitHub Actions run `28705012358` failed at `npm publish` with
  `npm error 404 Not Found - PUT https://registry.npmjs.org/pi-roblox-studio-tools`.
  npm `latest` stayed `0.2.2`; `0.2.3`/`0.2.4` never landed.
- **Root cause:** the workflow granted `id-token: write` but passed **no
  `NODE_AUTH_TOKEN`** to `npm publish`, because the docs claimed npm Trusted
  Publishing needs no token. `npm publish` therefore ran unauthenticated. The
  npm registry returns `404 Not Found` (not `401`) on unauthenticated publishes
  to avoid leaking which package names exist — so the missing-token failure
  surfaced as `E404`.
- **Fix:** `npm publish --provenance` now receives `NODE_AUTH_TOKEN:
  ${{ secrets.NPM_TOKEN }}` (see `.github/workflows/publish.yml`).

## Recovering a failed tag

GitHub re-runs a workflow using the workflow file at the tagged commit, so
re-running an old run does **not** pick up workflow fixes. To republish a tag
that failed before this fix (e.g. `v0.2.4`, still absent from npm):

1. Merge the publish-path fix into the default branch.
2. Ensure `NPM_TOKEN` is set.
3. Re-point the tag at the fixed commit and push:

   ```bash
   git tag -f v0.2.4 <fixed-commit>
   git push origin v0.2.4 --force
   ```

   Or delete the tag locally and on the remote, then recreate it on the fixed
   commit and push. Because npm never received `0.2.4`, republishing the same
   version is valid (no version conflict).

If you prefer not to move tags, run `npm publish --provenance` once locally from
the fixed commit while logged into npm.

## First release checklist

- [ ] `package.json` name is final
- [ ] `repository.url` points to the real GitHub repository
- [ ] `NPM_TOKEN` repository secret is set (npm Automation token)
- [ ] `npm run ci` passes
- [ ] `npm pack --dry-run` contains only intended files
- [ ] `CHANGELOG.md` has the release date
