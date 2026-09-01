# Feature: headless 出力で表示数式を検証する

pi-formula の worker として
利用者の可視画面を変えずに
表示数式の実表示を履歴全体で回帰検証したい

## Scenario: 全履歴を不可視の headless 出力で検証する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 現在の画像経路だけを使う headless 起動、全履歴キャプチャ、応答一致、時間上限、フォーカス不変確認、process group の後片付けが揃っている

## Scenario Outline: 改変された回帰入力を拒否する

- Given コーパスへ `<change>` を加えた assistant のセッション記録がある
- When 応答とコーパスの一致を検証する
- Then 改変された応答はキャプチャ前に拒否される

### Examples:

  | change         |
  | -------------- |
  | コードフェンス |
  | Unicode 化     |
  | 前置き         |
  | 欠落           |

## Scenario: 正常な表示数式には帯がない

- Given 帯のない表示数式の合成 PNG がある
- When ピクセル判定を実行する
- Then 表示数式のキャプチャは正常と判定される

## Scenario: 異常な表示数式の帯を報告する

- Given ID 色の水平帯がある表示数式の合成 PNG がある
- When ピクセル判定を実行する
- Then 水平帯の座標が報告される
