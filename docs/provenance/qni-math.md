---
summary: Provenance and related history of math image generation code imported from qni-cli
read_when:
  - Checking the origin, license, or import history of math image generation code
---

# Math image generation imported from qni-math

`src/typesetter.ts` and `src/layout.ts` started from the implementation verified in real terminals in the MIT-licensed `yasuhito/qni-cli`.

- Source repository: https://github.com/yasuhito/qni-cli
- Imported from: `2f12594e80b9e7baff0c85ecfecb4dd34d06f737`
- Original paths: `src/qni-math/typesetter.ts`, `src/qni-math/layout.ts`
- License: MIT, Copyright (c) 2020-2026 Yasuhito Takamiya

## Related history

```text
a606ab92d47c90e3bb8779d04780bf03fcbac4a0 feat: Pi本文の数式を端末画像で描く
2fc8815d7ffed0b1ad0ce52253313ad7b03c8704 feat: 数式描画のストリーミングとキャッシュを安定化
ed471fb15a82cf3b6f140ce825d7829b0d25fa6e feat: 数式描画に利用者マクロ設定を追加
3c92ebf39b655d97b24cfe08a563de0ce2c06975 fix: 数式画像の可読性を改善
9230958e2de3549b3ca949627f275b6c468f182a fix: 表示数式の大きさを本文に合わせる
2f12594e80b9e7baff0c85ecfecb4dd34d06f737 fix: インライン数式をUnicode表示に統一
```

The related history was rewritten to retain only `src/qni-math`, then connected to this repository as the second parent of the merge commit `chore: qni-mathの関連履歴を接続`. The original commit hashes are traceable in the list above. The rewritten history can be inspected even in a standalone clone with these commands:

```sh
merge=$(git log --merges --grep='qni-mathの関連履歴を接続' --format=%H -1)
git log --follow "$merge^2" -- typesetter.ts
git show "$merge^2:typesetter.ts"
```

Quantum macros were removed during import. The current `src/` does not include code for qni execution, qni-specific tools, or temporary workspaces.
