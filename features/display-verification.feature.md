# Feature: 独立した検証セッションで表示数式を検証する

pi-formula の worker として
利用者の画面と作業を妨げずに
表示数式の実表示を履歴全体で回帰検証したい

## Scenario: 利用者の画面から独立した検証セッションを使う

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 利用者の画面から独立した検証セッションで描画する

## Scenario: 全履歴を1枚で取得する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 計画した全履歴を1枚で取得する

## Scenario: 検証セッションの出力を計画高へ広げる

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 検証セッションの出力を計画高へ広げてから描画する

## Scenario: 外部処理へ時間上限を設ける

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 外部処理と検証ウィンドウへ時間上限を設ける

## Scenario: キャプチャを検証セッションへ向ける

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 検証セッションの窓口へキャプチャを向ける

## Scenario: 現在の拡張だけを読み込む

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 利用者の拡張を除外して現在の pi-formula を読み込む

## Scenario: 利用者設定とマクロを隔離する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 一時設定と空の利用者マクロを使う

## Scenario: 検証セッションの起動失敗を報告する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 検証セッションが起動しない場合は理由を添えて停止する

## Scenario: キャプチャの無応答を打ち切る

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then キャプチャへ時間上限と検証不能の終了コードを使う

## Scenario: 撮れた画面を必ず残して場所を伝える

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 保存先の指定がなくてもキャプチャを残して報告する

## Scenario: 描画が安定するまでキャプチャを再試行する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 前回のキャプチャと一致するまで実時間の期限内で撮り直す

## Scenario: 検証専用の追加マクロを読み込む

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 公開 API で追加マクロを登録する拡張を読み込む

## Scenario: 現在の画像経路を確認する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then キャプチャ前に画像経路を確認する

## Scenario: 描画完了を確認する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then ピクセル判定前に描画完了を確認する

## Scenario: 応答を一字一句確認する

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then キャプチャ前に応答一致を確認する

## Scenario: 検証セッションを後片付けする

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- When ハーネスの安全条件を調べる
- Then 失敗時も検証セッションの process group を止める

## Scenario: Issue 21 の再現コーパスを使う

- Given 実表示検証ハーネスと Issue 21 の再現コーパスがある
- Then Issue 21 の最後の表示数式がコーパスに含まれる

## Scenario: Issue 26 の再現原文を使う

- Given Issue 26 の再現コーパスがある
- Then 追加マクロを含む3つの表示数式を組版できる

## Scenario: Issue 48 の Grover コーパスを組版する

- Given Issue 48 の Grover コーパスがある
- Then bra と braket を含む表示数式を組版できる

## Scenario: braket の直後の項を分けて描く

- Given braket の直後に ket が続く表示数式がある
- Then braket と直後の ket は別の項として描かれる

## Scenario: bra の描画を保つ

- Given bra を使う表示数式がある
- Then bra は山括弧と縦線で描かれる

## Scenario: ket の描画を保つ

- Given ket を使う表示数式がある
- Then ket は縦線と山括弧で描かれる

## Scenario: Issue 52 の幅掃引コーパスを組版する

- Given Issue 52 の幅掃引コーパスがある
- Then 項数3から15までの7つの表示数式を組版できる

## Scenario: 検証ハーネスの追加マクロを qni-cli と揃える

- Given 検証ハーネスと書式だけが異なる qni-cli の追加マクロ定義がある
- Then 検証ハーネスの追加マクロは qni-cli と一致する

## Scenario: qni-cli の追加マクロ変更を検出する

- Given 検証ハーネスと値が異なる qni-cli の追加マクロ定義がある
- Then 検証ハーネスは qni-cli の定義差分を検出する

## Scenario: qni-cli の追加マクロ定義が見つからない理由を示す

- Given 追加マクロ定義のない qni-cli ソースがある
- When qni-cli の追加マクロ定義を読み取る
- Then 読み取り失敗は対象ファイルを示す

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
