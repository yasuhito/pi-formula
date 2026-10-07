# Feature: npm 配布物を導入し、利用できる内容を確認する

利用者は npm 配布物の案内から、表示、対応範囲、設定、安全性を確認できます。配布物には必要な利用者向けファイルが含まれ、公開 API と Pi 拡張として利用できます。

配布物に含まれる依存のライセンスと実行範囲を確認し、native の画像処理部品を実際に読み込めることを検査します。

## Scenario Outline: 各言語のREADMEから個別の利用案内が分かる

- Given pi-formula の英語と日本語の README がある
- When 利用者向けの導入、設定、対応範囲を調べる
- Then <言語> のREADMEに <案内> の案内がある

### Examples:

  | 言語 | 案内 |
  | --- | --- |
  | english | primaryInstall |
  | japanese | primaryInstall |
  | english | preview |
  | japanese | preview |
  | english | command |
  | japanese | command |
  | english | environmentConfig |
  | japanese | environmentConfig |
  | english | configFile |
  | japanese | configFile |
  | english | ghostty |
  | japanese | ghostty |
  | english | kitty |
  | japanese | kitty |
  | english | linux |
  | japanese | linux |
  | english | macOS |
  | japanese | macOS |
  | english | unsupported |
  | japanese | unsupported |
  | english | coexistence |
  | japanese | coexistence |
  | english | languageLink |
  | japanese | languageLink |

## Scenario: Piパッケージの画像URLはGhostty表示見本を指す

- Given pi-formula の Pi パッケージ情報がある
- When 画像情報を調べる
- Then Piパッケージの画像URLはGhostty表示見本を指す

## Scenario: Ghostty表示見本はPNG形式である

- Given pi-formula の Pi パッケージ情報がある
- When 画像情報を調べる
- Then Ghostty表示見本はPNG形式である

## Scenario: Ghostty表示見本の幅は775pxである

- Given pi-formula の Pi パッケージ情報がある
- When 画像情報を調べる
- Then Ghostty表示見本の幅は775pxである

## Scenario: Ghostty表示見本の高さは830pxである

- Given pi-formula の Pi パッケージ情報がある
- When 画像情報を調べる
- Then Ghostty表示見本の高さは830pxである

## Scenario: Ghostty表示見本は目視承認済みの画像と一致する

- Given pi-formula の Pi パッケージ情報がある
- When 画像情報を調べる
- Then Ghostty表示見本は目視承認済みの画像と一致する

## Scenario: npm tarball に利用者向け配布物だけを入れる

- When pi-formula の npm tarball を作る
- And tarball のファイル一覧を調べる
- Then src、dist、両言語の README、LICENSE、CHANGELOG、第三者部品情報、表示見本だけが配布される

## Scenario: npm tarball に Ghostty の表示見本を入れる

- When pi-formula の npm tarball を作る
- And tarball のファイル一覧を調べる
- Then Ghostty の表示見本が配布される

## Scenario: 古い成果物があるcheckoutでもbuildは正常終了する

- Given 削除済みソースに対応する古い成果物がある
- When pi-formula を build する
- Then 古い成果物があるcheckoutでもbuildは正常終了する

## Scenario: 生成後のdistには削除済みソースの成果物が残らない

- Given 削除済みソースに対応する古い成果物がある
- When pi-formula を build する
- Then 生成後のdistには削除済みソースの成果物が残らない

## Scenario: npm tarball から削除済みソースの古い成果物を除く

- Given 削除済みソースに対応する古い成果物がある
- When pi-formula の npm tarball を作る
- And tarball のファイル一覧を調べる
- Then tarball に古い成果物が配布されない

## Scenario: 導入したパッケージの拡張登録APIを呼び出せる

- Given 公開APIを試す新しいnpm導入先がある
- When 公開API試験用のtarballを作る
- And 公開API試験用のtarballをnpmで導入する
- And 導入したパッケージのルートを読み込む
- Then 導入したパッケージの拡張登録APIを呼び出せる

## Scenario: 導入したパッケージのPNG作成APIを呼び出せる

- Given 公開APIを試す新しいnpm導入先がある
- When 公開API試験用のtarballを作る
- And 公開API試験用のtarballをnpmで導入する
- And 導入したパッケージのルートを読み込む
- Then 導入したパッケージのPNG作成APIを呼び出せる

## Scenario: npm tarball の内部 subpath を公開しない

- Given 公開APIを試す新しいnpm導入先がある
- When 公開API試験用のtarballを作る
- And 公開API試験用のtarballをnpmで導入する
- And 導入したパッケージの内部 Markdown subpath を読み込む
- Then 内部 subpath は公開されていない

## Scenario: 公開候補のnpm packは正常終了する

- Given 本物のPiを試す新しい導入先と利用者設定がある
- When 公開候補のtarballを作る
- And 公開候補のtarballを本物のPiへ導入する
- And 導入した配布物のResvgと公開APIの由来を調べる
- And 導入先で本物のPiのコマンド一覧を問い合わせる
- Then 公開候補のnpm packは正常終了する

## Scenario: 公開候補のPiへの導入は正常終了する

- Given 本物のPiを試す新しい導入先と利用者設定がある
- When 公開候補のtarballを作る
- And 公開候補のtarballを本物のPiへ導入する
- And 導入した配布物のResvgと公開APIの由来を調べる
- And 導入先で本物のPiのコマンド一覧を問い合わせる
- Then 公開候補のPiへの導入は正常終了する

## Scenario: 導入した配布物のResvg検査は正常終了する

- Given 本物のPiを試す新しい導入先と利用者設定がある
- When 公開候補のtarballを作る
- And 公開候補のtarballを本物のPiへ導入する
- And 導入した配布物のResvgと公開APIの由来を調べる
- And 導入先で本物のPiのコマンド一覧を問い合わせる
- Then 導入した配布物のResvg検査は正常終了する

## Scenario: 公開APIは一時環境へ導入した配布物から読み込まれる

- Given 本物のPiを試す新しい導入先と利用者設定がある
- When 公開候補のtarballを作る
- And 公開候補のtarballを本物のPiへ導入する
- And 導入した配布物のResvgと公開APIの由来を調べる
- And 導入先で本物のPiのコマンド一覧を問い合わせる
- Then 公開APIは一時環境へ導入した配布物から読み込まれる

## Scenario: Resvgのnative部品は一時環境へ導入した配布物から読み込まれる

- Given 本物のPiを試す新しい導入先と利用者設定がある
- When 公開候補のtarballを作る
- And 公開候補のtarballを本物のPiへ導入する
- And 導入した配布物のResvgと公開APIの由来を調べる
- And 導入先で本物のPiのコマンド一覧を問い合わせる
- Then Resvgのnative部品は一時環境へ導入した配布物から読み込まれる

## Scenario: 導入したResvgのnative部品は現在のOSとCPUに対応する

- Given 本物のPiを試す新しい導入先と利用者設定がある
- When 公開候補のtarballを作る
- And 公開候補のtarballを本物のPiへ導入する
- And 導入した配布物のResvgと公開APIの由来を調べる
- And 導入先で本物のPiのコマンド一覧を問い合わせる
- Then 導入したResvgのnative部品は現在のOSとCPUに対応する

## Scenario: 導入したResvgでPNGデータを作れる

- Given 本物のPiを試す新しい導入先と利用者設定がある
- When 公開候補のtarballを作る
- And 公開候補のtarballを本物のPiへ導入する
- And 導入した配布物のResvgと公開APIの由来を調べる
- And 導入先で本物のPiのコマンド一覧を問い合わせる
- Then 導入したResvgでPNGデータを作れる

## Scenario: 配布物を調べた本物のPiは終了する

- Given 本物のPiを試す新しい導入先と利用者設定がある
- When 公開候補のtarballを作る
- And 公開候補のtarballを本物のPiへ導入する
- And 導入した配布物のResvgと公開APIの由来を調べる
- And 導入先で本物のPiのコマンド一覧を問い合わせる
- Then 配布物を調べた本物のPiは終了する

## Scenario: 本物のPiのコマンド一覧の応答は時間切れにならない

- Given 本物のPiを試す新しい導入先と利用者設定がある
- When 公開候補のtarballを作る
- And 公開候補のtarballを本物のPiへ導入する
- And 導入した配布物のResvgと公開APIの由来を調べる
- And 導入先で本物のPiのコマンド一覧を問い合わせる
- Then 本物のPiのコマンド一覧の応答は時間切れにならない

## Scenario: 本物のPiが導入したformulaコマンドを発見する

- Given 本物のPiを試す新しい導入先と利用者設定がある
- When 公開候補のtarballを作る
- And 公開候補のtarballを本物のPiへ導入する
- And 導入した配布物のResvgと公開APIの由来を調べる
- And 導入先で本物のPiのコマンド一覧を問い合わせる
- Then 本物のPiが導入したformulaコマンドを発見する

## Scenario: パッケージのライセンスはMITである

- Given pi-formula のライセンスと第三者部品情報がある
- When 由来、版、更新状況、ライセンス、既知の脆弱性を調べる
- Then パッケージのライセンスはMITである

## Scenario: 第三者部品情報にqni-cliの取り込み元commitが示される

- Given pi-formula のライセンスと第三者部品情報がある
- When 由来、版、更新状況、ライセンス、既知の脆弱性を調べる
- Then 第三者部品情報にqni-cliの取り込み元commitが示される

## Scenario: 依存監査の確認日は2026年8月31日である

- Given pi-formula のライセンスと第三者部品情報がある
- When 由来、版、更新状況、ライセンス、既知の脆弱性を調べる
- Then 依存監査の確認日は2026年8月31日である

## Scenario: 監査対象の直接依存がpackage情報と一致する

- Given pi-formula のライセンスと第三者部品情報がある
- When 由来、版、更新状況、ライセンス、既知の脆弱性を調べる
- Then 監査対象の直接依存がpackage情報と一致する

## Scenario: すべての直接依存が監査表に含まれる

- Given pi-formula のライセンスと第三者部品情報がある
- When 由来、版、更新状況、ライセンス、既知の脆弱性を調べる
- Then すべての直接依存が監査表に含まれる

## Scenario: 直接依存の版と更新状況とライセンスの監査表が保持される

- Given pi-formula のライセンスと第三者部品情報がある
- When 由来、版、更新状況、ライセンス、既知の脆弱性を調べる
- Then 直接依存の監査記録は次のとおりである

  | 部品 | 宣言版 | 確認版 | 公開日 | 更新状況 | ライセンス | 脆弱性 |
  | --- | --- | --- | --- | --- | --- | --- |
  | @mathjax/src | `^4.1.3` (lockfile: `4.1.3`) | `4.1.3` | 2026-07-03 | Current | Apache-2.0 | None (`npm audit`) |
  | @resvg/resvg-js | `^2.6.2` (lockfile: `2.6.2`) | `2.6.2` | 2024-03-26 | Current stable; next `2.7.0-alpha.2` (2026-01-28) | MPL-2.0 | None (`npm audit`) |
  | @earendil-works/pi-coding-agent | `*` (verified: `0.84.4`) | `0.84.4` | 2026-08-28 | Current | MIT | None (`npm audit`) |
  | @earendil-works/pi-tui | `*` (verified: `0.84.4`) | `0.84.4` | 2026-08-28 | Current | MIT | None (`npm audit`) |
