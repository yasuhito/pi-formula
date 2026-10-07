# Feature: 公開 API で既成 PNG を端末へ描く

連携拡張は、Buffer またはファイルの既成 PNG を公開 API で端末へ描けます。画像転送と placeholder を対応させ、描画後に背景色や dim を残しません。

画像経路を使えない場合や、画像の形式・寸法・展開量が条件を満たさない場合は描画せず、拒否理由を返します。

## Scenario: 既成PNGの描画は成功する

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの描画は成功する

## Scenario: 既成PNGの描画成功時に拒否理由はない

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの描画成功時に拒否理由はない

## Scenario: 既成PNGの描画結果には画像転送が含まれる

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの描画結果には画像転送が含まれる

## Scenario: 既成PNGの描画結果にはplaceholderが含まれる

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの描画結果にはplaceholderが含まれる

## Scenario: 既成PNGの配置は8列以内に収まる

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの配置は8列以内に収まる

## Scenario: 既成PNGの配置は1行以上を使う

- Given 画像経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの配置は1行以上を使う

## Scenario: 既成PNGの画像IDは危険域の3バイトを保持する

- Given 危険域のバイトを含む画像 ID になる既成 PNG がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGの画像IDは危険域の3バイトを保持する

## Scenario: placeholderの下線色はコロン形式で表現される

- Given 危険域のバイトを含む画像 ID になる既成 PNG がある
- When Buffer の既成 PNG を公開 API で描く
- Then placeholderの下線色はコロン形式で表現される

## Scenario: placeholder出力後に背景色は残らない

- Given 危険域のバイトを含む画像 ID になる既成 PNG がある
- When Buffer の既成 PNG を公開 API で描く
- And placeholder出力後のSGR状態を読み取る
- Then placeholder出力後に背景色は残らない

## Scenario: placeholder出力後にdimは残らない

- Given 危険域のバイトを含む画像 ID になる既成 PNG がある
- When Buffer の既成 PNG を公開 API で描く
- And placeholder出力後のSGR状態を読み取る
- Then placeholder出力後にdimは残らない

## Scenario: ファイルの既成PNGは描画される

- Given 画像経路を使う試験用の連携拡張がある
- When ファイルの既成 PNG を公開 API で描く
- Then ファイルの既成PNGは描画される

## Scenario: ファイルの既成PNGはPNG画像を転送する

- Given 画像経路を使う試験用の連携拡張がある
- When ファイルの既成 PNG を公開 API で描く
- Then ファイルの既成PNGはPNG画像を転送する

## Scenario: 画像を使えない端末では既成PNGを描画しない

- Given テキスト経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 画像を使えない端末では既成PNGを描画しない

## Scenario: 既成PNGを描画しない理由は画像経路を使えないことである

- Given テキスト経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 既成PNGを描画しない理由は画像経路を使えないことである

## Scenario: テキスト経路での拒否では、拒否結果には描画状態と拒否理由だけがある

- Given テキスト経路を使う試験用の連携拡張がある
- When Buffer の既成 PNG を公開 API で描く
- Then 拒否結果には描画状態と拒否理由だけがある

## Scenario: 寸法の安全上限を超える PNG では、安全上限を超えた既成PNGは描画しない

- Given 画像経路を使う試験用の連携拡張がある
- When 安全上限を超える既成 PNG を公開 API で描く
- Then 安全上限を超えた既成PNGは描画しない

## Scenario: 寸法の安全上限を超える PNG では、既成PNGの拒否理由は安全上限である

- Given 画像経路を使う試験用の連携拡張がある
- When 安全上限を超える既成 PNG を公開 API で描く
- Then 既成PNGの拒否理由は安全上限である

## Scenario: 寸法の安全上限を超える PNG では、拒否結果には描画状態と拒否理由だけがある

- Given 画像経路を使う試験用の連携拡張がある
- When 安全上限を超える既成 PNG を公開 API で描く
- Then 拒否結果には描画状態と拒否理由だけがある

## Scenario: 不正な既成PNGは描画しない

- Given 画像経路を使う試験用の連携拡張がある
- When 途中で切れた既成 PNG を公開 API で描く
- Then 不正な既成PNGは描画しない

## Scenario: 既成PNGの拒否理由はPNG形式の不正である

- Given 画像経路を使う試験用の連携拡張がある
- When 途中で切れた既成 PNG を公開 API で描く
- Then 既成PNGの拒否理由はPNG形式の不正である

## Scenario: 途中で切れた PNG の拒否では、拒否結果には描画状態と拒否理由だけがある

- Given 画像経路を使う試験用の連携拡張がある
- When 途中で切れた既成 PNG を公開 API で描く
- Then 拒否結果には描画状態と拒否理由だけがある

## Scenario: 展開上限を超える PNG では、安全上限を超えた既成PNGは描画しない

- Given 画像経路を使う試験用の連携拡張がある
- When 展開上限を超える既成 PNG を公開 API で描く
- Then 安全上限を超えた既成PNGは描画しない

## Scenario: 展開上限を超える PNG では、既成PNGの拒否理由は安全上限である

- Given 画像経路を使う試験用の連携拡張がある
- When 展開上限を超える既成 PNG を公開 API で描く
- Then 既成PNGの拒否理由は安全上限である

## Scenario: 展開上限を超える PNG では、拒否結果には描画状態と拒否理由だけがある

- Given 画像経路を使う試験用の連携拡張がある
- When 展開上限を超える既成 PNG を公開 API で描く
- Then 拒否結果には描画状態と拒否理由だけがある
