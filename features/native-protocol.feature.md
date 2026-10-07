# Feature: libghostty-vt で画像経路のプロトコル状態を検査する

プロトコル検査は、エンコーダと Pi の画像経路が出力した storage・配置・逐次更新の状態を libghostty-vt で観察します。native 依存がない環境では、検査を省略したことを示して正常終了します。

実際の vt-pty を使う検査は、専用タグで通常の検査から選び分けられます。

## Scenario: vt-ptyのないプロトコル検査は正常終了する

- Given vt-pty がない環境がある
- When プロトコル検査の入口を実行する
- Then vt-ptyのないプロトコル検査は正常終了する

## Scenario: プロトコル検査はvt-ptyがないためskipしたことを表示する

- Given vt-pty がない環境がある
- When プロトコル検査の入口を実行する
- Then プロトコル検査はvt-ptyがないためskipしたことを表示する

## Scenario: vt-ptyのないPiプロトコル検査は正常終了する

- Given vt-pty がない環境がある
- When Pi を通したプロトコル検査を実行する
- Then vt-ptyのないPiプロトコル検査は正常終了する

## Scenario: Piプロトコル検査はvt-ptyがないためskipしたことを表示する

- Given vt-pty がない環境がある
- When Pi を通したプロトコル検査を実行する
- Then Piプロトコル検査はvt-ptyがないためskipしたことを表示する

## Scenario: 環境変数で指定したvt-ptyは正常終了する

- Given 環境変数で指定した vt-pty がある
- When プロトコル検査の入口を実行する
- Then 環境変数で指定したvt-ptyは正常終了する

## Scenario: 環境変数で指定したvt-ptyの出力が返る

- Given 環境変数で指定した vt-pty がある
- When プロトコル検査の入口を実行する
- Then 環境変数で指定したvt-ptyの出力が返る

## Scenario: vt-ptyのないエンコーダ検査は正常終了する

- Given vt-pty がない環境がある
- When エンコーダ層のプロトコル検査を実行する
- Then vt-ptyのないエンコーダ検査は正常終了する

## Scenario: エンコーダ検査はvt-ptyがないためskipしたことを表示する

- Given vt-pty がない環境がある
- When エンコーダ層のプロトコル検査を実行する
- Then エンコーダ検査はvt-ptyがないためskipしたことを表示する

`@native-vt`
## Scenario: エンコーダの storage 検査は正常終了する

- When エンコーダ層の storage を検査する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: storage に計画どおりの PNG 画像が一件ある

- When エンコーダ層の storage を検査する
- Then storage に計画どおりの PNG 画像が一件ある

`@native-vt`
## Scenario: 未ビルド checkout の文書化されたエンコーダ検査は正常終了する

- Given ビルド成果物がない検査用 checkout がある
- And テキスト経路の利用者設定と tmux 端末環境がある
- When 文書化されたエンコーダ層の検査入口を実行する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 隔離したエンコーダのstorage検査が報告される

- Given ビルド成果物がない検査用 checkout がある
- And テキスト経路の利用者設定と tmux 端末環境がある
- When 文書化されたエンコーダ層の検査入口を実行する
- Then 隔離したエンコーダのstorage検査が報告される

`@native-vt`
## Scenario: 隔離したcheckoutにextensionのビルド成果物が作られる

- Given ビルド成果物がない検査用 checkout がある
- And テキスト経路の利用者設定と tmux 端末環境がある
- When 文書化されたエンコーダ層の検査入口を実行する
- Then 隔離したcheckoutにextensionのビルド成果物が作られる

`@native-vt`
## Scenario: エンコーダの仮想配置検査は正常終了する

- When エンコーダ層の仮想配置を検査する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 仮想配置の列数と行数が計画と一致する

- When エンコーダ層の仮想配置を検査する
- Then 仮想配置の列数と行数が計画と一致する

`@native-vt`
## Scenario: エンコーダの placeholder 画像 ID 検査は正常終了する

- When エンコーダ層の placeholder の画像 ID を検査する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: foreground RGB から復元した画像 ID が計画と一致する

- When エンコーダ層の placeholder の画像 ID を検査する
- Then foreground RGB から復元した画像 ID が計画と一致する

`@native-vt`
## Scenario: エンコーダの placeholder 座標検査は正常終了する

- When エンコーダ層の placeholder の座標を検査する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: diacritics から復元した座標が欠けも余りもなく並ぶ

- When エンコーダ層の placeholder の座標を検査する
- Then diacritics から復元した座標が欠けも余りもなく並ぶ

`@native-vt`
## Scenario: エンコーダの placeholder 下線色タグ検査は正常終了する

- When エンコーダ層の placeholder の下線色タグを検査する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: すべての placeholder セルの下線色タグが RGB である

- When エンコーダ層の placeholder の下線色タグを検査する
- Then すべての placeholder セルの下線色タグが RGB である

`@native-vt`
## Scenario: 同じ Markdown の二回目のエンコーダ出力検査は正常終了する

- When 同じ Markdown の二回目のエンコーダ出力を検査する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 二回目も storage に画像がある

- When 同じ Markdown の二回目のエンコーダ出力を検査する
- Then 二回目も storage に画像がある

`@native-vt`
## Scenario: 画像転送のないエンコーダ出力の検査は終了コード1を返す

- When 画像転送を省いたエンコーダ出力を検査する
- Then 画像転送のないエンコーダ出力の検査は終了コード1を返す

`@native-vt`
## Scenario: エンコーダ検査はplaceholderのIDに仮想配置がないことを表示する

- When 画像転送を省いたエンコーダ出力を検査する
- Then エンコーダ検査はplaceholderのIDに仮想配置がないことを表示する

`@native-vt`
## Scenario: 文字を出力する子プロセスの収束検査は正常終了する

- Given vt-ptyで文字を出力する子プロセスの命令がある
- When 子プロセスの出力が落ち着くまで待つ
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: プロトコルの本文セルにhelloが報告される

- Given vt-ptyで文字を出力する子プロセスの命令がある
- When 子プロセスの出力が落ち着くまで待つ
- Then プロトコルの本文セルにhelloが報告される

`@native-vt`
## Scenario: プロトコルの画像配置数は0件と報告される

- Given vt-ptyで文字を出力する子プロセスの命令がある
- When 子プロセスの出力が落ち着くまで待つ
- Then プロトコルの画像配置数は0件と報告される

`@native-vt`
## Scenario: プロトコルのAPC漏れは0件と報告される

- Given vt-ptyで文字を出力する子プロセスの命令がある
- When 子プロセスの出力が落ち着くまで待つ
- Then プロトコルのAPC漏れは0件と報告される

`@native-vt`
## Scenario: 遅れて届く仮想配置を待つ検査は正常終了する

- Given vt-pty の収束時間より遅れて仮想配置を出力する子プロセスがある
- When 子プロセスの出力が落ち着くまで待つ
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 必要な仮想配置を受け取ってからプロトコル状態が出力される

- Given vt-pty の収束時間より遅れて仮想配置を出力する子プロセスがある
- When 子プロセスの出力が落ち着くまで待つ
- Then 必要な仮想配置を受け取ってからプロトコル状態が出力される

`@native-vt`
## Scenario: 仮想配置後も続く出力の検査は正常終了する

- Given 必要な仮想配置の後も出力を続ける子プロセスがある
- When 子プロセスの出力が落ち着くまで待つ
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 出力の静止を待たずにプロトコル状態が出力される

- Given 必要な仮想配置の後も出力を続ける子プロセスがある
- When 子プロセスの出力が落ち着くまで待つ
- Then 出力の静止を待たずにプロトコル状態が出力される

`@native-vt`
## Scenario: 仮想配置後に分かれて届く placeholder と本文の検査は正常終了する

- Given 仮想配置の後に placeholder と本文を分けて出力し続ける子プロセスがある
- When 子プロセスの出力が落ち着くまで待つ
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 遅れて届いたplaceholderの画像IDと座標が報告される

- Given 仮想配置の後に placeholder と本文を分けて出力し続ける子プロセスがある
- When 子プロセスの出力が落ち着くまで待つ
- Then 遅れて届いたplaceholderの画像IDと座標が報告される

`@native-vt`
## Scenario: 仮想配置に続くafter-placement本文が報告される

- Given 仮想配置の後に placeholder と本文を分けて出力し続ける子プロセスがある
- When 子プロセスの出力が落ち着くまで待つ
- Then 仮想配置に続くafter-placement本文が報告される

`@native-vt`
## Scenario: 不足した仮想配置を待つ検査は正常終了しない

- Given 一部の仮想配置を出した後も出力を続ける子プロセスがある
- When 子プロセスの出力が落ち着くまで待つ
- Then プロトコル検査の終了コードは0ではない

`@native-vt`
## Scenario: timeout 時点の仮想配置数が出力される

- Given 一部の仮想配置を出した後も出力を続ける子プロセスがある
- When 子プロセスの出力が落ち着くまで待つ
- Then timeout 時点の仮想配置数が出力される

`@native-vt`
## Scenario: 長い grapheme cluster の出力検査は正常終了する

- Given vt-ptyで長いgrapheme clusterを出力する子プロセスの命令がある
- When 子プロセスの出力が落ち着くまで待つ
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 長いgrapheme clusterの本文セルにaが報告される

- Given vt-ptyで長いgrapheme clusterを出力する子プロセスの命令がある
- When 子プロセスの出力が落ち着くまで待つ
- Then 長いgrapheme clusterの本文セルにaが報告される

`@native-vt`
## Scenario: 長いgrapheme clusterのAPC漏れは0件と報告される

- Given vt-ptyで長いgrapheme clusterを出力する子プロセスの命令がある
- When 子プロセスの出力が落ち着くまで待つ
- Then 長いgrapheme clusterのAPC漏れは0件と報告される

`@native-vt`
## Scenario: 期限を超える子プロセスの検査は正常終了しない

- Given vt-pty の期限を超えて動く子プロセスがある
- When プロトコル検査の入口を実行する
- Then プロトコル検査の終了コードは0ではない

`@native-vt`
## Scenario: timeout は成功として扱われない

- Given vt-pty の期限を超えて動く子プロセスがある
- When プロトコル検査の入口を実行する
- Then timeout は成功として扱われない

`@native-vt`
## Scenario: 起動できない子プロセスの検査は正常終了しない

- Given vt-pty から起動できない子プロセスがある
- When プロトコル検査の入口を実行する
- Then プロトコル検査の終了コードは0ではない

`@native-vt`
## Scenario: 子プロセスの起動失敗は成功として扱われない

- Given vt-pty から起動できない子プロセスがある
- When プロトコル検査の入口を実行する
- Then 子プロセスの起動失敗は成功として扱われない

## Scenario: 本文の APC 断片を検出する Pi 検査は終了コード1を返す

- Given 本文セルに APC の断片を返す vt-pty がある
- When Pi を通したプロトコル検査を実行する
- Then プロトコル検査の終了コードは 1 である

## Scenario: 本文セルの APC 断片を検出して失敗する

- Given 本文セルに APC の断片を返す vt-pty がある
- When Pi を通したプロトコル検査を実行する
- Then 本文セルの APC 断片を検出して失敗する

## Scenario: 描画が落ち着かないPiプロトコル検査は終了コード2を返す

- Given 描画が落ち着かない vt-pty がある
- When Pi を通したプロトコル検査を実行する
- Then 描画が落ち着かないPiプロトコル検査は終了コード2を返す

## Scenario: Piプロトコル検査は描画の時間切れの理由を表示する

- Given 描画が落ち着かない vt-pty がある
- When Pi を通したプロトコル検査を実行する
- Then Piプロトコル検査は描画の時間切れの理由を表示する

## Scenario: vt-ptyのないストリーミング検査は正常終了する

- Given vt-pty がない環境がある
- When ストリーミング中のプロトコル検査を実行する
- Then vt-ptyのないストリーミング検査は正常終了する

## Scenario: ストリーミング検査はvt-ptyがないためskipしたことを表示する

- Given vt-pty がない環境がある
- When ストリーミング中のプロトコル検査を実行する
- Then ストリーミング検査はvt-ptyがないためskipしたことを表示する

`@native-vt`
## Scenario: ストリーミングのフレーム順序検査は正常終了する

- Given Pi の未完了本文と確定本文を順に描く検査がある
- When ストリーミング中のプロトコル検査を実行する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 複数のフレームが時系列で検査されたと報告される

- Given Pi の未完了本文と確定本文を順に描く検査がある
- When ストリーミング中のプロトコル検査を実行する
- Then 複数のフレームが時系列で検査されたと報告される

`@native-vt`
## Scenario: 先行する tool 出力を保つ差分描画検査は正常終了する

- Given Pi の未完了本文と確定本文を順に描く検査がある
- When ストリーミング中のプロトコル検査を実行する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 先行する tool 出力を保った3回の差分描画が報告される

- Given Pi の未完了本文と確定本文を順に描く検査がある
- When ストリーミング中のプロトコル検査を実行する
- Then 先行する tool 出力を保った3回の差分描画が報告される

`@native-vt`
## Scenario: 完了フレームの仮想配置と画像 ID の対応検査は正常終了する

- Given Pi の未完了本文と確定本文を順に描く検査がある
- When ストリーミング中のプロトコル検査を実行する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 各完了フレームの仮想配置と placeholder の画像 ID が対応すると報告される

- Given Pi の未完了本文と確定本文を順に描く検査がある
- When ストリーミング中のプロトコル検査を実行する
- Then 各完了フレームの仮想配置と placeholder の画像 ID が対応すると報告される

`@native-vt`
## Scenario: ストリーミング途中の APC 断片検査は正常終了する

- Given Pi の未完了本文と確定本文を順に描く検査がある
- When ストリーミング中のプロトコル検査を実行する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 途中のどのフレームにも APC の断片がないと報告される

- Given Pi の未完了本文と確定本文を順に描く検査がある
- When ストリーミング中のプロトコル検査を実行する
- Then 途中のどのフレームにも APC の断片がないと報告される

`@native-vt`
## Scenario: 最終フレームの表示数式と仮想配置数の検査は正常終了する

- Given Pi の未完了本文と確定本文を順に描く検査がある
- When ストリーミング中のプロトコル検査を実行する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 最終フレームの表示数式と仮想配置の数が一致する

- Given Pi の未完了本文と確定本文を順に描く検査がある
- When ストリーミング中のプロトコル検査を実行する
- Then 最終フレームの表示数式と仮想配置の数が一致する

## Scenario: placeholder の欠落を検出する Pi 検査は終了コード1を返す

- Given placeholder のない仮想配置を返す vt-pty がある
- When Pi を通したプロトコル検査を実行する
- Then プロトコル検査の終了コードは 1 である

## Scenario: 仮想配置に対応する placeholder の欠落を検出して失敗する

- Given placeholder のない仮想配置を返す vt-pty がある
- When Pi を通したプロトコル検査を実行する
- Then 仮想配置に対応する placeholder の欠落を検出して失敗する

`@native-vt`
## Scenario: 保存済み Pi セッションの placeholder 清潔性検査は正常終了する

- Given Piで開く保存済みコーパスセッションがある
- When Pi を通したプロトコル検査を実行する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: placeholder セルの汚れがないと報告される

- Given Piで開く保存済みコーパスセッションがある
- When Pi を通したプロトコル検査を実行する
- Then placeholder セルの汚れがないと報告される

`@native-vt`
## Scenario: 保存済み Pi セッションの本文 APC 断片検査は正常終了する

- Given Piで開く保存済みコーパスセッションがある
- When Pi を通したプロトコル検査を実行する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 本文セルに APC の断片がないと報告される

- Given Piで開く保存済みコーパスセッションがある
- When Pi を通したプロトコル検査を実行する
- Then 本文セルに APC の断片がないと報告される

`@native-vt`
## Scenario: 保存済み Pi セッションの数式と storage 付き仮想配置数の検査は正常終了する

- Given Piで開く保存済みコーパスセッションがある
- When Pi を通したプロトコル検査を実行する
- Then プロトコル検査の終了コードは 0 である

`@native-vt`
## Scenario: 表示数式と storage 付き仮想配置の数が一致する

- Given Piで開く保存済みコーパスセッションがある
- When Pi を通したプロトコル検査を実行する
- Then 表示数式と storage 付き仮想配置の数が一致する

`@native-vt`
## Scenario: セミコロン形式の下線色を検出する Pi 検査は終了コード1を返す

- Given 下線色をセミコロン形式へ戻した pi-formula がある
- When Pi を通したプロトコル検査を実行する
- Then プロトコル検査の終了コードは 1 である

`@native-vt`
## Scenario: placeholder セルの汚れを検出して失敗する

- Given 下線色をセミコロン形式へ戻した pi-formula がある
- When Pi を通したプロトコル検査を実行する
- Then placeholder セルの汚れを検出して失敗する

`@native-vt`
## Scenario: 端末の既定前景色を子プロセスへ返す

- Given vt-pty の既定前景色を問い合わせる子プロセスがある
- When 子プロセスの出力が落ち着くまで待つ
- Then 子プロセスが既定前景色の応答を受け取る

`@native-vt`
## Scenario: 端末の既定背景色を子プロセスへ返す

- Given vt-pty の既定背景色を問い合わせる子プロセスがある
- When 子プロセスの出力が落ち着くまで待つ
- Then 子プロセスが既定背景色の応答を受け取る
