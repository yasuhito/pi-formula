# Feature: npm 配布物から pi-formula を理解して監査する

pi-formula の利用者として
導入前に表示、対応範囲、設定、安全性を確認したい
必要な利用者向けファイルだけを取得したい

## Scenario: 英語と日本語の利用案内から導入方法と対応範囲を確認する

- Given pi-formula の英語と日本語の README がある
- When 利用者向けの導入、設定、対応範囲を調べる
- Then 両言語から導入方法、表示見本、formula コマンド、設定、対応端末、対応 OS、未対応範囲、他の数式拡張との併用注意が分かる

## Scenario: Pi パッケージ一覧で Ghostty の表示見本を見る

- Given pi-formula の Pi パッケージ情報がある
- When 画像情報を調べる
- Then Unicode のインライン数式と画像の表示数式を含む Ghostty 表示見本が設定されている

## Scenario: npm tarball に利用者向け配布物だけを入れる

- Given pi-formula の npm tarball を作る
- When tarball のファイル一覧を調べる
- Then src、dist、両言語の README、LICENSE、CHANGELOG、第三者部品情報、表示見本だけが配布される

## Scenario: npm tarball に Ghostty の表示見本を入れる

- Given pi-formula の npm tarball を作る
- When tarball のファイル一覧を調べる
- Then Ghostty の表示見本が配布される

## Scenario: 公開候補 tarball を隔離環境で試験する

- Given pi-formula の公開候補 tarball がある
- When tarball を新しい一時環境へ導入して本物の Pi で調べる
- Then 導入した配布物だけから OS 用 Resvg が読み込まれ formula コマンドが発見される

## Scenario: 直接依存と由来を日付付きで監査する

- Given pi-formula のライセンスと第三者部品情報がある
- When 由来、版、更新状況、ライセンス、既知の脆弱性を調べる
- Then MIT License、取り込み元、すべての直接依存の監査結果と確認日が分かる
