# Feature: セッション記録のツール失敗を検査する

pi-formula の worker として
表示が正常でも道具が期待どおり働かなかった状態を見逃さないために
検証ハーネスが起動した Pi のセッション記録を決定的に検査したい

## Scenario: シンボリック実行の機能不足を抽出する

- Given `unsupported symbolic gate column` を含むセッション記録がある
- When セッション記録検査を実行する
- Then 機能不足が qni の該当コマンドと文脈を伴って報告される

## Scenario: ツールの非 0 終了を抽出する

- Given `unsupported symbolic gate column` を含むセッション記録がある
- When セッション記録検査を実行する
- Then qni の非 0 終了が該当コマンドとともに報告される

## Scenario: 複数コマンドの途中停止を抽出する

- Given `unsupported symbolic gate column` を含むセッション記録がある
- When セッション記録検査を実行する
- Then qni の途中停止が停止したコマンドとともに報告される

## Scenario: 代替手段への切り替えを抽出する

- Given 失敗後にモデルが代替手段へ切り替えたセッション記録がある
- When セッション記録検査を実行する
- Then 代替手段への切り替えが直前のツールとコマンドを伴って報告される

## Scenario: ヒットがあれば検査に失敗する

- Given `unsupported symbolic gate column` を含むセッション記録がある
- When セッション記録検査を実行する
- Then セッション記録検査は終了コード1を返す

## Scenario: ヒットがなければ検査に成功する

- Given ツールが成功したセッション記録がある
- When セッション記録検査を実行する
- Then セッション記録は正常と判定される

## Scenario: 既知の許容パターンを除外する

- Given 既知の機能不足を許容する無視リストがある
- When 無視リストを使ってセッション記録検査を実行する
- Then 許容した機能不足だけが報告から除外される
