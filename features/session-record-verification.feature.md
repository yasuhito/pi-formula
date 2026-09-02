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

## Scenario: 単一コマンドを実行したツール名で報告する

- Given runner が単一の check コマンドで機能不足になったセッション記録がある
- When セッション記録検査を実行する
- Then 機能不足のコマンドは runner check と報告される

## Scenario: 途中停止したコマンドを実行したツール名で報告する

- Given runner の2番目の deploy コマンドで途中停止したセッション記録がある
- When セッション記録検査を実行する
- Then 途中停止のコマンドは runner deploy と報告される

## Scenario: 代替手段への切り替えを抽出する

- Given 失敗後にモデルが代替手段へ切り替えたセッション記録がある
- When セッション記録検査を実行する
- Then 代替手段への切り替えが直前のツールとコマンドを伴って報告される

## Scenario: 成功したツールの後にある通常の代替表現を無視する

- Given 成功したツールの後に「代わりに」を含む assistant 本文がある
- When セッション記録検査を実行する
- Then 成功結果の後の代替表現は報告されない

## Scenario: 失敗直後より後にある無関係な代替表現を無視する

- Given 失敗後の次の assistant 本文には代替表現がなく後続本文に fallback がある
- When セッション記録検査を実行する
- Then 失敗直後より後の代替表現は報告されない

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

## Scenario: 無視対象外の非 0 終了を残す

- Given 既知の機能不足を許容する無視リストがある
- When 無視リストを使ってセッション記録検査を実行する
- Then 無視対象外の非 0 終了が報告に残る

## Scenario: 無視対象外のヒットがあれば検査に失敗する

- Given 既知の機能不足を許容する無視リストがある
- When 無視リストを使ってセッション記録検査を実行する
- Then 無視対象外のヒットにより終了コード1を返す

## Scenario Outline: 空文字の無視条件を拒否する

- Given `<field>` が空文字の無視リストがある
- When 無視リストを使ってセッション記録検査を実行する
- Then 無効な無視リストとして終了コード2を返す

### Examples:

  | field   |
  | ------- |
  | kind    |
  | tool    |
  | command |
  | pattern |
