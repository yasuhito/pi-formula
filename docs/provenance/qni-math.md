---
summary: qni-cliから取り込んだ数式画像作成コードの由来と関連履歴
read_when:
  - 数式画像作成コードの由来、ライセンス、取り込み履歴を確認する時
---

# qni-mathから取り込んだ数式画像作成

`src/typesetter.ts`と`src/layout.ts`は、MITライセンスの`yasuhito/qni-cli`で実端末検証した実装を出発点にした。

- 元リポジトリ: https://github.com/yasuhito/qni-cli
- 取り込み元: `2f12594e80b9e7baff0c85ecfecb4dd34d06f737`
- 元の場所: `src/qni-math/typesetter.ts`、`src/qni-math/layout.ts`
- ライセンス: MIT、Copyright (c) 2020-2026 Yasuhito Takamiya

## 関連履歴

```text
a606ab92d47c90e3bb8779d04780bf03fcbac4a0 feat: Pi本文の数式を端末画像で描く
2fc8815d7ffed0b1ad0ce52253313ad7b03c8704 feat: 数式描画のストリーミングとキャッシュを安定化
ed471fb15a82cf3b6f140ce825d7829b0d25fa6e feat: 数式描画に利用者マクロ設定を追加
3c92ebf39b655d97b24cfe08a563de0ce2c06975 fix: 数式画像の可読性を改善
9230958e2de3549b3ca949627f275b6c468f182a fix: 表示数式の大きさを本文に合わせる
2f12594e80b9e7baff0c85ecfecb4dd34d06f737 fix: インライン数式をUnicode表示に統一
```

関連履歴は`src/qni-math`だけを残した履歴へ書き換え、`chore: qni-mathの関連履歴を接続`というmerge commitの第2親としてこのリポジトリへ接続した。元のcommit hashは上の一覧で追跡でき、書き換え後の履歴は単独cloneでも次のコマンドで確認できる。

```sh
merge=$(git log --merges --grep='qni-mathの関連履歴を接続' --format=%H -1)
git log --follow "$merge^2" -- typesetter.ts
git show "$merge^2:typesetter.ts"
```

取り込み時に量子系マクロを削除した。qni実行、qni専用ツール、一時作業場所のコードは現在の`src/`に含めていない。
