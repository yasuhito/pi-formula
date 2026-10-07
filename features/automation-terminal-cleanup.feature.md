# Feature: automation precheck で完了した端末だけを後片付けする

Orca automation の precheck は、完了扱いの run に対応する terminal でも、agent がまだ働いている場合は閉じません。最終出力から端末の状態を判断して後片付けします。

## Scenario Outline: precheckの子プロセス起動にエラーはない

- Given terminal の最終出力が「<状態>」である
- When 「<precheck>」precheck を実行する
- Then precheckの子プロセス起動にエラーはない

### Examples:

  | 状態 | precheck | 呼び出し |
  | --- | --- | --- |
  | 直近 | PR reviewer | なし |
  | 2分より前 | PR reviewer | worker-terminal |
  | 記録なし | PR reviewer | worker-terminal |
  | 直近 | issue coordinator | なし |
  | 2分より前 | issue coordinator | worker-terminal |
  | 記録なし | issue coordinator | worker-terminal |

## Scenario Outline: precheckは終了コード0を返す

- Given terminal の最終出力が「<状態>」である
- When 「<precheck>」precheck を実行する
- Then precheckは終了コード0を返す

### Examples:

  | 状態 | precheck | 呼び出し |
  | --- | --- | --- |
  | 直近 | PR reviewer | なし |
  | 2分より前 | PR reviewer | worker-terminal |
  | 記録なし | PR reviewer | worker-terminal |
  | 直近 | issue coordinator | なし |
  | 2分より前 | issue coordinator | worker-terminal |
  | 記録なし | issue coordinator | worker-terminal |

## Scenario Outline: precheckはシグナルで終了しない

- Given terminal の最終出力が「<状態>」である
- When 「<precheck>」precheck を実行する
- Then precheckはシグナルで終了しない

### Examples:

  | 状態 | precheck | 呼び出し |
  | --- | --- | --- |
  | 直近 | PR reviewer | なし |
  | 2分より前 | PR reviewer | worker-terminal |
  | 記録なし | PR reviewer | worker-terminal |
  | 直近 | issue coordinator | なし |
  | 2分より前 | issue coordinator | worker-terminal |
  | 記録なし | issue coordinator | worker-terminal |

## Scenario Outline: precheckは標準出力へ何も書かない

- Given terminal の最終出力が「<状態>」である
- When 「<precheck>」precheck を実行する
- Then precheckは標準出力へ何も書かない

### Examples:

  | 状態 | precheck | 呼び出し |
  | --- | --- | --- |
  | 直近 | PR reviewer | なし |
  | 2分より前 | PR reviewer | worker-terminal |
  | 記録なし | PR reviewer | worker-terminal |
  | 直近 | issue coordinator | なし |
  | 2分より前 | issue coordinator | worker-terminal |
  | 記録なし | issue coordinator | worker-terminal |

## Scenario Outline: precheckは標準エラーへ何も書かない

- Given terminal の最終出力が「<状態>」である
- When 「<precheck>」precheck を実行する
- Then precheckは標準エラーへ何も書かない

### Examples:

  | 状態 | precheck | 呼び出し |
  | --- | --- | --- |
  | 直近 | PR reviewer | なし |
  | 2分より前 | PR reviewer | worker-terminal |
  | 記録なし | PR reviewer | worker-terminal |
  | 直近 | issue coordinator | なし |
  | 2分より前 | issue coordinator | worker-terminal |
  | 記録なし | issue coordinator | worker-terminal |

## Scenario Outline: terminal closeは "指定値" だけ呼ばれる

- Given terminal の最終出力が「<状態>」である
- When 「<precheck>」precheck を実行する
- Then terminal closeは "<呼び出し>" だけ呼ばれる

### Examples:

  | 状態 | precheck | 呼び出し |
  | --- | --- | --- |
  | 直近 | PR reviewer | なし |
  | 2分より前 | PR reviewer | worker-terminal |
  | 記録なし | PR reviewer | worker-terminal |
  | 直近 | issue coordinator | なし |
  | 2分より前 | issue coordinator | worker-terminal |
  | 記録なし | issue coordinator | worker-terminal |
