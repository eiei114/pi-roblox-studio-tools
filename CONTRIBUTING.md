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

Releases use npm Trusted Publishing with `auto-release.yml` and `publish.yml`.
Do not add `NPM_TOKEN` to GitHub Secrets.

```bash
npm version patch
git push
```

On `main`, a `package.json` version bump triggers auto-release, which creates the
tag and dispatches `publish.yml`. See [`docs/release.md`](docs/release.md) for
setup details.
