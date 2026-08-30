# npm 公開手順

pi-formula は初回だけ 1Password を使って手元から公開する。2回目以降は、`vX.Y.Z` タグから GitHub Actions を起動し、人間の承認後に npm の信頼された公開を使う。

## 初回公開

前提:

- npm の `pi-formula` パッケージを公開できるアカウントが 1Password に保存されている。
- npm のアクセストークンとワンタイムパスワードのフィールドを `op://` 形式で参照できる。
- `op account get` と `npm whoami` に必要な認証が済んでいる。

1. `package.json` と `CHANGELOG.md` の版を確定し、公開対象のコミットへ `vX.Y.Z` タグを付ける。
2. タグと同じコミットで全チェックと tarball の内容確認を実行する。

   ```sh
   npm ci
   npm run release:prepare -- v0.1.0 .release
   npm pack --dry-run
   ```

3. 1Password の秘密参照を環境変数へ設定する。値そのものを入力しない。ワンタイムパスワードの参照には `?attribute=otp` を付ける。

   ```sh
   export OP_NPM_TOKEN_REF='op://<vault>/<npm item>/<token field>'
   export OP_NPM_OTP_REF='op://<vault>/<npm item>/<one-time password field>?attribute=otp'
   ```

4. シェルの追跡を無効にした `scripts/publish-initial.sh` を実行する。

   ```sh
   scripts/publish-initial.sh .release/pi-formula-0.1.0.tgz
   ```

このスクリプトは一時 `.npmrc` に秘密参照だけを書き、`op run` の子プロセスへトークンと OTP を渡す。秘密情報を標準出力へ表示せず、ファイルやログへ値を保存しない。一時 `.npmrc` は終了時に削除する。

5. npm の版を確認し、検証済みのローカルコミットが `origin/main` と一致することを確認する。タグはまだ push しない。

   ```sh
   npm view pi-formula@0.1.0 version dist.integrity
   git fetch origin main
   test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
   ```

6. `initial-release` を手動で起動する。

   ```sh
   gh workflow run release.yml --ref main -f tag=v0.1.0
   gh run list --workflow release.yml --event workflow_dispatch --limit 1
   gh run watch <run-id>
   ```

`initial-release` は同じ全チェックを再実行し、指定版と tarball の integrity が npm の公開物に一致することを確認してから、選択したコミットに遠隔タグを付け、`pi-formula 0.1.0` という題名と `release-notes.md` を持つ GitHub Release を作る。タグ作成には workflow の `GITHUB_TOKEN` を使うため、タグ push 用の公開処理は新しく起動せず、同じ npm 版を再公開しない。初回版は 1Password で手動公開するため、OpenID Connect の由来証明は付かない。

## 継続公開の事前設定

初回公開後、npm のパッケージ設定で GitHub Actions を信頼された公開元として登録する。

- Organization or user: `yasuhito`
- Repository: `pi-formula`
- Workflow filename: `release.yml`
- Environment: `npm`
- Allowed actions: `npm publish`

GitHub の repository environment `npm` を作り、required reviewer に保守者を設定する。`npm` environment に npm トークンは登録しない。`.github/workflows/release.yml` は `id-token: write` で OpenID Connect の短期資格情報を取得し、`npm publish --provenance` で由来証明を付ける。

## 継続公開

1. `package.json` の版と `CHANGELOG.md` の同じ版の箇条書きを確定する。
2. `npm run release:prepare -- vX.Y.Z .release` を手元で実行し、全チェック、tarball、`release-notes.md` を確認する。
3. 公開対象のコミットへ `vX.Y.Z` タグを付け、タグだけを push する。
4. GitHub Actions の `prepare` が全チェック、タグと版の一致、tarball 内容を再確認する。
5. `publish` が `npm` environment の承認待ちになったら、版と成果物を確認して人間が承認する。
6. 承認後、信頼された公開で npm へ公開し、`pi-formula X.Y.Z` という題名の GitHub Release を作る。Release 本文には同じ版の CHANGELOG の箇条書きを同じ順で使う。

## 公開後の確認

`X.Y.Z` を公開版へ置き換えて実行する。

```sh
npm view pi-formula@X.Y.Z version dist-tags dist.integrity
git ls-remote origin refs/tags/vX.Y.Z
gh release view vX.Y.Z --json name,tagName,body,url
workdir=$(mktemp -d)
(cd "$workdir" && npm init -y && npm install pi-formula@X.Y.Z && npm audit signatures)
rm -rf "$workdir"
```

さらに新しい一時環境で `pi install npm:pi-formula@X.Y.Z` を実行し、Pi が拡張を読み込めることを確認する。継続公開では、npm の Provenance 表示から `yasuhito/pi-formula` の `release.yml` と対象タグに由来することも確認する。1Password を使う初回版には OpenID Connect の由来証明がないため、この Provenance 表示の確認だけを省く。

## 認証または外部サービスで止まった場合

npm、GitHub Actions、GitHub environment、OpenID Connect、1Password の認証や権限で止まった場合は再試行しない。失敗した段階、エラーメッセージ、不足条件を報告し、人間が解消するまで公開を止める。

npm 公開後に GitHub Release 作成だけが止まった場合も workflow 全体を再実行しない。npm に同じ版を再公開せず、公開済みの npm 版とタグを保ったまま不足条件を報告する。
