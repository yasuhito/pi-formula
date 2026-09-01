# セッション記録のツール失敗検査

`scripts/verify-session-tools.js` は、Pi のセッション記録から、表示だけでは分からないツールの失敗、機能不足、途中停止、代替手段への切り替えを抽出する決定的な検査である。

## 実行

検証ハーネスが起動したセッションの JSONL を指定する。

```sh
npm run verify:session-record -- ~/.pi/agent/sessions/<project>/<session>.jsonl
```

ヒットがなければ0、ヒットがあれば1、引数、JSONL、無視リストの読み取りまたは解析に失敗すると2で終了する。ヒットには種類、ツール、コマンド、JSONLの行番号、前後1行の文脈を表示する。長い文脈行は300文字で打ち切る。

次を検出する。

- `exited with status N`、`exited with code N`、`Command exited with code N` の非0終了
- 「未対応」「対応していない」「unsupported」「not supported」を含むツール出力
- `Stopped at command N of M` による一括実行の途中停止
- 「代わりに」「代替手段」「切り替え」「fallback」を含む、失敗したツール実行直後の assistant 本文

複数コマンドを一括実行した記録では、ツール出力の直前にある `$ ...`、または `Stopped at command N of M` の N 番目から該当コマンドを決める。代替手段は、失敗、機能不足、途中停止のいずれかを含むか `isError` が真であるツール結果だけを候補にする。その次の assistant メッセージだけを検査して候補を消費するため、成功結果の後や後続ターンの無関係な表現は関連付けない。

## 無視リスト

既知で許容するヒットは JSON の無視リストで除外する。

```json
{
  "ignore": [
    {
      "kind": "機能不足",
      "tool": "qni",
      "command": "qni run --symbolic",
      "pattern": "unsupported symbolic gate column"
    }
  ]
}
```

```sh
npm run verify:session-record -- \
  --ignore=path/to/ignore-list.json \
  ~/.pi/agent/sessions/<project>/<session>.jsonl
```

各項目には `kind`、`tool`、`command`、`pattern` の一つ以上を空文字以外で指定する。指定した条件をすべて満たすヒットだけを除外する。`pattern` は大文字と小文字を区別しない正規表現として、ヒットした行へ適用する。空文字の条件は設定ミスとして終了コード2で拒否する。

## 表示検査との関係

実表示検証は、表示数式の色帯や黒帯をピクセルで検出する。セッション記録検査は、表示が正常でも道具が期待どおり働かなかった状態を検出する。検査面が異なるため、片方の結果にかかわらず、二つのコマンドをそれぞれ実行する。

```sh
scripts/verify-display docs/agents/verify-corpus/issue-21.md
npm run verify:session-record -- <verify-display が起動した session.jsonl>
```

現在の `scripts/verify-display` は `--no-tools` で Pi を起動し、一時セッション記録を終了時に削除する。そのため、通常の実表示検証ではツール失敗は発生しない。ツールを使う別の headless 検証ハーネスでは、そのハーネスが起動したセッション記録を第2コマンドへ渡す。セッション記録検査はウィンドウを作らず、表示検査の実行や後片付けを妨げない。
