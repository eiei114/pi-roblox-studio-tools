# Template Setup Checklist

このリポジトリを公開前に確認すること。

## Repository

- [x] Repository name: `pi-roblox-studio-tools`
- [ ] GitHub repositoryを作成する
- [ ] GitHub Aboutを書く
- [ ] GitHub topicsを設定する
  - [ ] `pi`
  - [ ] `pi-package`
  - [ ] `roblox`
  - [ ] `mcp`
  - [ ] `typescript`
- [x] Repository URLを `package.json` に反映する
- [x] READMEのplaceholderを置き換える

## Package metadata

- [x] `package.json.name` を `pi-roblox-studio-tools` に変更する
- [x] `description` を書く
- [x] `author` を入れる
- [x] `repository.url` を埋める
- [x] `bugs.url` を埋める
- [x] `homepage` を埋める
- [x] `keywords` を見直す
- [ ] `LICENSE` の年・名前を確認する

## Pi package manifest

- [x] `pi.extensions` は `./extensions` のみ
- [x] `pi.skills` は `./skills` のみ
- [x] 不要な `prompts/` を削除
- [x] 不要な `themes/` を削除
- [x] sample namesを実名に変更

## TypeScript

- [x] `extensions/index.ts` をRoblox Studio MCP用に更新
- [x] `extensions/hello.ts` を削除
- [x] 共通ロジックを `lib/studio-mcp.ts` に分離
- [x] `strict: true` を維持
- [x] custom tool parametersをTypeBox schemaで定義
- [x] Pi提供packageは `peerDependencies` に置く
- [x] `package.json.files` を公開対象だけに絞る

## CI / Release

- [x] `npm run ci` が通る
- [x] `npm pack --dry-run` が通る
- [ ] npm Automation tokenを発行し、GitHub repo secret `NPM_TOKEN` を設定する
- [ ] `npm publish --provenance` と `NODE_AUTH_TOKEN` が `publish.yml` で設定されていることを確認する（npmはtokenless Trusted Publishing非対応）
- [ ] tag publishを初回リリースで確認する

## Before first release

- [ ] `pi -e .` でローカルロード確認
- [ ] GitHub repo作成後 `pi install git:github.com/eiei114/pi-roblox-studio-tools` を試す
- [ ] READMEのQuick startが動くことを確認する
- [ ] CHANGELOGに `0.1.0` の内容を書く
- [ ] stdio MCP client helperを実装するか、status-only MVPとして明示する