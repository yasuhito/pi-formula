# Feature: 固定した libghostty-vt を指定した場所へビルドする計画を作る

ビルド計画は固定した commit の libghostty-vt を使い、指定された native prefix に header、library、vt-pty を配置します。Zig のビルド命令も、この prefix を参照します。

## Scenario: libghostty-vtのビルド計画は正常終了する

- Given ホーム側のnative prefix設定がある
- When libghostty-vt のビルド計画を出力する
- Then libghostty-vtのビルド計画は正常終了する

## Scenario: libghostty-vtのビルド計画は固定したcommitを使う

- Given ホーム側のnative prefix設定がある
- When libghostty-vt のビルド計画を出力する
- Then libghostty-vtのビルド計画は固定したcommitを使う

## Scenario: libghostty-vtのビルド計画は指定したprefixを使う

- Given ホーム側のnative prefix設定がある
- When libghostty-vt のビルド計画を出力する
- Then libghostty-vtのビルド計画は指定したprefixを使う

## Scenario: ビルド計画のheaderは指定prefixのincludeにある

- Given ホーム側のnative prefix設定がある
- When libghostty-vt のビルド計画を出力する
- Then ビルド計画のheaderは指定prefixのincludeにある

## Scenario: ビルド計画のlibraryは指定prefixのlibにある

- Given ホーム側のnative prefix設定がある
- When libghostty-vt のビルド計画を出力する
- Then ビルド計画のlibraryは指定prefixのlibにある

## Scenario: ビルド計画のvt-ptyは指定prefixのbinにある

- Given ホーム側のnative prefix設定がある
- When libghostty-vt のビルド計画を出力する
- Then ビルド計画のvt-ptyは指定prefixのbinにある

## Scenario: Zigのビルド命令は指定prefixだけを使う

- Given ホーム側のnative prefix設定がある
- When libghostty-vt のビルド計画を出力する
- Then Zigのビルド命令は指定prefixだけを使う
