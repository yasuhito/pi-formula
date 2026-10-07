# Feature: 表示数式の文字を同じセリフ体で組版する

pi-formula の利用者として
日本語を含む表示数式を数式本体と揃えて読みたい
英字だけの表示数式も従来どおり読みたい

## Scenario: 優先候補の日本語の表示数式は画像になる

- Given priority のセリフ体候補がある画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 優先候補の日本語の表示数式は画像になる

## Scenario: 優先候補の日本語の画像にはPNG署名がある

- Given priority のセリフ体候補がある画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 優先候補の日本語の画像にはPNG署名がある

## Scenario: 日本語の組版には優先候補のセリフ体設定がResvgへ渡る

- Given priority のセリフ体候補がある画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 日本語の組版には優先候補のセリフ体設定がResvgへ渡る

## Scenario: 優先候補の日本語のSVGには19個のpathがある

- Given priority のセリフ体候補がある画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 優先候補の日本語のSVGには19個のpathがある

## Scenario: 日本語のtextの内容と尺度はResvgへ渡る

- Given priority のセリフ体候補がある画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 日本語のtextの内容と尺度はResvgへ渡る

## Scenario: 診断には日本語に選んだ優先候補のセリフ体が表示される

- Given priority のセリフ体候補がある画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 診断には日本語に選んだ優先候補のセリフ体が表示される

## Scenario: ASCIIの表示数式は画像になる

- Given priority のセリフ体候補がある画像経路
- When ASCII の text を含む表示数式を Resvg まで組版する
- Then ASCIIの表示数式は画像になる

## Scenario: ASCIIの画像にはPNG署名がある

- Given priority のセリフ体候補がある画像経路
- When ASCII の text を含む表示数式を Resvg まで組版する
- Then ASCIIの画像にはPNG署名がある

## Scenario: ASCIIの組版には優先候補のセリフ体設定がResvgへ渡る

- Given priority のセリフ体候補がある画像経路
- When ASCII の text を含む表示数式を Resvg まで組版する
- Then ASCIIの組版には優先候補のセリフ体設定がResvgへ渡る

## Scenario: ASCIIのSVGには26個のpathがある

- Given priority のセリフ体候補がある画像経路
- When ASCII の text を含む表示数式を Resvg まで組版する
- Then ASCIIのSVGには26個のpathがある

## Scenario: ASCIIの組版にSVGのtextは含まれない

- Given priority のセリフ体候補がある画像経路
- When ASCII の text を含む表示数式を Resvg まで組版する
- Then ASCIIの組版にSVGのtextは含まれない

## Scenario: 診断にはASCIIに選んだセリフ体が表示される

- Given priority のセリフ体候補がある画像経路
- When ASCII の text を含む表示数式を Resvg まで組版する
- Then 診断にはASCIIに選んだセリフ体が表示される

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

## Scenario: 候補のセリフ体がなくても日本語の表示数式は画像になる

- Given CJK 対応セリフ体がない画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 候補のセリフ体がなくても日本語の表示数式は画像になる

## Scenario: 候補のセリフ体がない日本語の画像にもPNG署名がある

- Given CJK 対応セリフ体がない画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 候補のセリフ体がない日本語の画像にもPNG署名がある

## Scenario: 候補のセリフ体がない組版はsystem fontを使う

- Given CJK 対応セリフ体がない画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 候補のセリフ体がない組版はsystem fontを使う

## Scenario: 候補のセリフ体がない日本語のSVGには19個のpathがある

- Given CJK 対応セリフ体がない画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 候補のセリフ体がない日本語のSVGには19個のpathがある

## Scenario: system fontでも日本語のtextの内容と尺度はResvgへ渡る

- Given CJK 対応セリフ体がない画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then system fontでも日本語のtextの内容と尺度はResvgへ渡る

## Scenario: 診断にはsystem fontへのfallbackが表示される

- Given CJK 対応セリフ体がない画像経路
- When 日本語の text を含む表示数式を Resvg まで組版する
- Then 診断にはsystem fontへのfallbackが表示される
