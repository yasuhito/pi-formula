# Feature: 表示数式の文字を同じセリフ体で組版する

pi-formula の利用者として
日本語を含む表示数式を数式本体と揃えて読みたい
英字だけの表示数式も従来どおり読みたい

## Scenario: 日本語の text を含む表示数式を画像にする

- Given 画像経路で text を組版できる Pi がある
- When 日本語の text を含む表示数式を変換する
- Then 日本語を含む表示数式が画像になる

## Scenario: ASCII の text を含む表示数式を画像にする

- Given 画像経路で text を組版できる Pi がある
- When ASCII の text を含む表示数式を変換する
- Then ASCII を含む表示数式が画像になる

## Scenario: formula status で表示数式のセリフ体を確認する

- Given 画像経路で text を組版できる Pi がある
- When 表示数式を変換して formula status を実行する
- Then 選ばれたセリフ体またはシステムの代替が表示される
