# npm 公開手順

pi-formula は `vX.Y.Z` タグから GitHub Actions を起動し、人間の承認後に npm の信頼された公開を使う。

## 公開の事前設定

npm のパッケージ設定で GitHub Actions を信頼された公開元として登録する。

- Organization or user: `yasuhito`
- Repository: `pi-formula`
- Workflow filename: `release.yml`
- Environment: `npm`
- Allowed actions: `npm publish`

GitHub の repository environment `npm` を作り、required reviewer に保守者を設定する。`npm` environment に npm トークンは登録しない。`.github/workflows/release.yml` は `id-token: write` で OpenID Connect の短期資格情報を取得し、`npm publish --provenance` で由来証明を付ける。

## リリース情報の準備

`release-metadata.json` がレビュー対象の原本。新しい版を先頭に追加し、版、日付、箇条書きの順序を確定する。`npm version patch --no-git-tag-version` などで package と lock の版を合わせ、`npm run changelog:generate` で `CHANGELOG.md` を生成する。生成物は直接編集しない。`npm run check` は生成物が最新かも検査する。

その後 `npm run release:prepare -- vX.Y.Z .release` を実行する。この手順が全チェックと tarball 作成を行い、生成済み CHANGELOG から同じ順序の `release-notes.md` を抽出する。

## 公開

1. 上記の「リリース情報の準備」を行う。
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

さらに新しい一時環境で `pi install npm:pi-formula@X.Y.Z` を実行し、Pi が拡張を読み込めることを確認する。npm の Provenance 表示から `yasuhito/pi-formula` の `release.yml` と対象タグに由来することも確認する。

## 認証または外部サービスで止まった場合

npm、GitHub Actions、GitHub environment、OpenID Connect の認証や権限で止まった場合は再試行しない。失敗した段階、エラーメッセージ、不足条件を報告し、人間が解消するまで公開を止める。

npm 公開後に GitHub Release 作成だけが止まった場合も workflow 全体を再実行しない。npm に同じ版を再公開せず、公開済みの npm 版とタグを保ったまま不足条件を報告する。
