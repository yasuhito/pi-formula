# Feature: headless 出力で表示数式を検証する

pi-formula の worker として
利用者の可視画面を変えずに
表示数式の実表示を履歴全体で回帰検証したい

## Scenario: headless 出力を作成する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 検証専用の headless 出力を作成する

## Scenario: 全履歴を1枚で取得する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 計画した全履歴を1枚で取得する

## Scenario: 検証ウィンドウを不可視で起動する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 検証ウィンドウを headless 出力へフォーカスなしで起動する

## Scenario: 外部処理へ時間上限を設ける

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 外部処理と検証ウィンドウへ時間上限を設ける

## Scenario: 可視画面のフォーカスを変えない

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 起動後も可視画面のフォーカスが変わらないことを確認する

## Scenario: 現在の拡張だけを読み込む

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 利用者の拡張を除外して現在の pi-formula を読み込む

## Scenario: 利用者設定とマクロを隔離する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 一時設定と空の利用者マクロを使う

## Scenario: 現在の画像経路を確認する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then キャプチャ前に画像経路を確認する

## Scenario: 応答を一字一句確認する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then キャプチャ前に応答一致を確認する

## Scenario: process group と headless 出力を後片付けする

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 失敗時も process group と headless 出力を後片付けする

## Scenario: Issue 21 の再現コーパスを使う

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- Then Issue 21 の最後の表示数式がコーパスに含まれる

## Scenario: Issue 26 の再現原文を使う

- Given Issue 26 の再現コーパスがある
- Then 最初の表示数式と後続二式がコーパスに含まれる

## Scenario: 短いが高い表示数式を事前に拒否する

- Given 16000px を超える高い表示数式を含む短いコーパスがある
- When 表示数式の画像行数を含む出力高を計画する
- Then 全履歴が収まらないコーパスは描画前に拒否される

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
