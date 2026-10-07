# Feature: 現 HEAD の独立レビュー判定を再利用する

PR reviewer として
完了済みの独立レビュー判定を失わずに再利用し
同じ HEAD の review worker を重ねて起動したくない

## Scenario: 有効な独立レビューの解決は正常終了する

- Given 現 HEAD の有効な PASS レポートが残っている
- When レビュー判定フローを解決する
- Then 有効な独立レビューの解決は正常終了する

## Scenario: 有効な独立レビューのレポートは保持される

- Given 現 HEAD の有効な PASS レポートが残っている
- When レビュー判定フローを解決する
- Then 有効な独立レビューのレポートは保持される

## Scenario: 現HEADの有効なレポートは有効と判定される

- Given 現 HEAD の有効な PASS レポートが残っている
- When レビュー判定フローを解決する
- Then 現HEADの有効なレポートは有効と判定される

## Scenario: 有効な独立レビューではterminal作成を要求しない

- Given 現 HEAD の有効な PASS レポートが残っている
- When レビュー判定フローを解決する
- Then 有効な独立レビューではterminal作成を要求しない

## Scenario: 有効な独立レビューの次の段階は6.2である

- Given 現 HEAD の有効な PASS レポートが残っている
- When レビュー判定フローを解決する
- Then 有効な独立レビューの次の段階は6.2である

## Scenario Outline: 無効な独立レビューの解決は正常終了する

- Given 現 HEAD のレポートが「<欠陥>」である
- When レビュー判定フローを解決する
- Then 無効な独立レビューの解決は正常終了する

### Examples:

  | 欠陥 |
  | --- |
  | ファイルなし |
  | HEAD 不一致 |
  | VERDICT なし |
  | COMPLETE なし |

## Scenario Outline: 無効な独立レビューのレポートは削除される

- Given 現 HEAD のレポートが「<欠陥>」である
- When レビュー判定フローを解決する
- Then 無効な独立レビューのレポートは削除される

### Examples:

  | 欠陥 |
  | --- |
  | ファイルなし |
  | HEAD 不一致 |
  | VERDICT なし |
  | COMPLETE なし |

## Scenario Outline: 欠陥のあるレポートは無効と判定される

- Given 現 HEAD のレポートが「<欠陥>」である
- When レビュー判定フローを解決する
- Then 欠陥のあるレポートは無効と判定される

### Examples:

  | 欠陥 |
  | --- |
  | ファイルなし |
  | HEAD 不一致 |
  | VERDICT なし |
  | COMPLETE なし |

## Scenario Outline: 無効な独立レビューではterminal作成を要求する

- Given 現 HEAD のレポートが「<欠陥>」である
- When レビュー判定フローを解決する
- Then 無効な独立レビューではterminal作成を要求する

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
