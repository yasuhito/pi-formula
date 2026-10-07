# Feature: 初めて表示数式を描くときに画像処理部品を読み込む

拡張の読み込み・登録やセッション開始では、MathJax と Resvg を読み込みません。初めて表示数式を画像へ変換するときに読み込みます。

## Scenario: 数式の描画前にはMathJaxもResvgも読み込まれていない

- Given 新しいNode.jsプロセスで拡張を読み込んで登録したPiがある
- When 分離プロセスで画像経路のセッションを開始する
- And 表示数式を初めて変換する
- Then 数式の描画前にはMathJaxもResvgも読み込まれていない

## Scenario: セッション開始だけではMathJaxもResvgも読み込まれない

- Given 新しいNode.jsプロセスで拡張を読み込んで登録したPiがある
- When 分離プロセスで画像経路のセッションを開始する
- And 表示数式を初めて変換する
- Then セッション開始だけではMathJaxもResvgも読み込まれない

## Scenario: 最初の表示数式でMathJaxとResvgが読み込まれる

- Given 新しいNode.jsプロセスで拡張を読み込んで登録したPiがある
- When 分離プロセスで画像経路のセッションを開始する
- And 表示数式を初めて変換する
- Then 最初の表示数式でMathJaxとResvgが読み込まれる
