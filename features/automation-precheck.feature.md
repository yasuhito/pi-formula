# Feature: automation precheck の terminal 後片付け

Orca automation の利用者として
完了扱いの run に対応する terminal で agent がまだ働いている場合に
precheck がその terminal を閉じないようにしたい

## Scenario Outline: terminal の最終出力時刻に応じて閉じ分ける

- Given terminal の最終出力が「<状態>」である
- When 「<precheck>」precheck を実行する
- Then precheck は正常終了し terminal close は「<呼び出し>」だけ呼ばれる

### Examples:

| 状態 | precheck | 呼び出し |
| --- | --- | --- |
| 直近 | PR reviewer | なし |
| 2分より前 | PR reviewer | worker-terminal |
| 記録なし | PR reviewer | worker-terminal |
| 直近 | issue coordinator | なし |
| 2分より前 | issue coordinator | worker-terminal |
| 記録なし | issue coordinator | worker-terminal |
