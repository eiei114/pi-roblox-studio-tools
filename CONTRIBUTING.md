# Contributing

Thanks for helping improve this Pi package.

## Development

```bash
npm install
npm run ci
```

## Local Pi testing

```bash
pi -e .
```

## Pull requests

Before opening a PR:

- Run `npm run ci`
- Update docs when behavior changes
- Update `CHANGELOG.md` for user-facing changes
- Keep package contents small and intentional

## Release

Releases publish to npm from GitHub Actions when a `v*` tag is pushed. The
publish is authenticated with an npm **automation token** stored in the
`NPM_TOKEN` repository secret (passed to `npm publish` as `NODE_AUTH_TOKEN`)
and signed with npm **provenance** (`--provenance` + `permissions:
id-token: write`). See [`docs/release.md`](docs/release.md) for full setup.

> npm has no tokenless "Trusted Publishing"; `NPM_TOKEN` is required.

```bash
npm version patch
git push --follow-tags
```