# Feature: 現 HEAD の独立レビュー判定を再利用する

PR reviewer として
完了済みの独立レビュー判定を失わずに再利用し
同じ HEAD の review worker を重ねて起動したくない

## Scenario: 有効な判定では review terminal を作らない

- Given 現 HEAD の有効な PASS レポートが残っている
- When レビュー判定フローを解決する
- Then レポートを残して terminal を作らず判定へ進む

## Scenario Outline: 無効な判定ではレポートを削除して worker を起動する

- Given 現 HEAD のレポートが「<欠陥>」である
- When レビュー判定フローを解決する
- Then 無効なレポートを削除して terminal を作る

### Examples:

| 欠陥 |
| --- |
| ファイルなし |
| HEAD 不一致 |
| VERDICT なし |
| COMPLETE なし |

## Scenario: 再利用した PASS 判定も merge gate へ進める

- Given 現 HEAD の有効な PASS レポートが残っている
- When レビュー判定フローを解決する
- Then 再利用した PASS 判定の行き先は 7.5 である
