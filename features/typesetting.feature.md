# Feature: 表示数式の文字を同じセリフ体で組版する

pi-formula の利用者として
日本語を含む表示数式を数式本体と揃えて読みたい
英字だけの表示数式も従来どおり読みたい

## Scenario: 日本語の text に実在するセリフ体を使う

- Given priority のセリフ体候補がある画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 選んだセリフ体と日本語の組版尺度が Resvg へ渡る

## Scenario: ASCII の text を従来どおり組版する

- Given priority のセリフ体候補がある画像経路
- When ASCII の text を含む表示数式を Resvg まで組版する
- Then ASCII は従来どおりパスとして Resvg へ渡る

## Scenario Outline: 実在するセリフ体を候補の優先順で選ぶ

- Given <inventory> のセリフ体候補がある画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then "<family>" が表示数式のセリフ体に選ばれる

### Examples:

  | inventory | family              |
  | ---------- | ------------------- |
  | priority   | Noto Serif CJK JP   |
  | source-jp  | Source Han Serif JP |
  | source     | Source Han Serif    |
  | ipa        | IPAexMincho         |

## Scenario: CJK 対応セリフ体がなくても描画を続ける

- Given CJK 対応セリフ体がない画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then システムのセリフ体へ戻って日本語の PNG 描画を続ける
