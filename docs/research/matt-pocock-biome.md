# Matt Pocockの公開リポジトリからBiome設定を検討する

調査日: 2026-09-01

## 結論

Matt Pocockの現行リポジトリから、そのままコピーできるBiome設定は見つからなかった。調査した代表7リポジトリでは、書式整形にPrettier、静的検査にTypeScriptかESLintを使っている。`course-video-manager`には`biome-ignore`コメントが2件あるものの、Biomeの設定ファイル、依存、実行スクリプトはない（[対象コミットのツリー](https://github.com/mattpocock/course-video-manager/tree/892003a32955fbea606ff63ae7eaefe46ac40dcd)、[package.json](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/package.json)、[コメント例](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/apps/local/components/ui/kibo-ui/code-block/server.tsx)）。このコメントだけをBiome採用の根拠にはできない。

したがって、pi-formulaでは「Matt PocockのBiomeプリセット」を再現しない。彼のリポジトリで一貫して確認できる**書式の好みとCIの分け方**だけをBiomeへ移し、リンター規則はBiomeの`recommended`を基準にするのが妥当である。

pi-formulaへ転用する設定は次のとおり。

- 2スペース、行幅80、ダブルクォート、セミコロンあり、括弧内スペースあり
- 末尾カンマは`all`、アロー関数の引数括弧は`always`
- `biome check .`をCI相当の`check`へ組み込み、型チェックとテストも別工程として残す
- Biomeの`recommended`を有効にする。TypeScriptの`strict`はBiomeで置き換えない
- Biomeのバージョンを固定し、設定の`$schema`も同じバージョンへ固定する

逆に、pnpm・Turborepo・Husky・lint-staged、ReactやEffect向けESLintプラグイン、Matt固有の例外規則は持ち込まない。小規模なCommonJSライブラリであるpi-formulaには、運用コストのほうが大きい。

## 現行リポジトリはBiomeではなくPrettier・TypeScript・ESLintを使っている

### 比較結果

| リポジトリ | 役割・近さ | 書式・静的検査 | CIで実行するもの | pi-formulaへの示唆 |
| --- | --- | --- | --- | --- |
| [`ts-reset`](https://github.com/mattpocock/ts-reset/tree/81b3b2614a32e47948cd4b8d5468879c07c2b361) | 公開TypeScript npmライブラリ。今回の比較対象で最も近い | `lint`は`tsc`。書式はPrettierで、2スペース、行幅80、ダブルクォート、セミコロンあり、末尾カンマ`all`（[package.json](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/package.json)） | `build`、export map検査、`tsc`、独自package.json検査、`format:check`をまとめて実行（[workflow](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/.github/workflows/main.yml)） | 書式と「型チェック・書式・パッケージ検査を別責務として残す」考え方を採る |
| [`total-typescript-monorepo`](https://github.com/mattpocock/total-typescript-monorepo/tree/fd2f2802c859a5880eec8ad9f035d02583946d04) | Total TypeScriptの現行モノレポ | ルートはPrettier。staged fileを`prettier --ignore-unknown --write`で整形する（[package.json](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/package.json)、[.lintstagedrc](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/.lintstagedrc)）。一部のRemotionアプリだけが固有のESLint設定を持つ（[eslint.config.mjs](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/apps/remotion-subtitle-renderer/eslint.config.mjs)） | GitHub Actionsから`pnpm run ci`を呼び、Turborepoで`build test lint`を実行（[package.json](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/package.json)、[workflow](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/.github/workflows/ci.yml)） | 単一の`check`から必要な検査を束ねる考え方だけを採る。モノレポ基盤は不要 |
| [`total-typescript-monorepo-template`](https://github.com/mattpocock/total-typescript-monorepo-template/tree/fc7cd055eac9acd69ef111b44ccd93dc0b99d05f) | Matt本人のモノレポ雛形。ただし最終更新は2024年 | ルートにPrettier依存。例示パッケージのスクリプトは`tsc`とVitestだけで、BiomeもESLintもない（[root package.json](https://github.com/mattpocock/total-typescript-monorepo-template/blob/fc7cd055eac9acd69ef111b44ccd93dc0b99d05f/package.json)、[example package](https://github.com/mattpocock/total-typescript-monorepo-template/blob/fc7cd055eac9acd69ef111b44ccd93dc0b99d05f/packages/_example-package/package.json)） | `turbo build test lint`（[package.json](https://github.com/mattpocock/total-typescript-monorepo-template/blob/fc7cd055eac9acd69ef111b44ccd93dc0b99d05f/package.json)、[workflow](https://github.com/mattpocock/total-typescript-monorepo-template/blob/fc7cd055eac9acd69ef111b44ccd93dc0b99d05f/.github/workflows/ci.yml)） | Biome設定の参考にはならない。古い雛形のツール構成もコピーしない |
| [`ai-hero-cli`](https://github.com/mattpocock/ai-hero-cli/tree/ffdd3900d6c0740b1d18f1845dd3caf829d234b0) | 現行TypeScript CLI・npmパッケージ | ESLint 9のflat configで`eslint:recommended`と`@typescript-eslint/recommended`を使う。未使用変数、type-only importなどを追加検査する（[eslint.config.mjs](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs)）。Prettierは行幅65・2スペース（[package.json](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/package.json)） | 型チェック、ESLint、テストを別stepで実行。書式チェックはCIにない（[workflow](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/.github/workflows/ci.yml)） | `recommended`を出発点にし、型チェックを別途残す。Effectや独自構文向け規則は採らない |
| [`evalite`](https://github.com/mattpocock/evalite/tree/e18a793789400b9292f92465d1084344340aef9b) | 現行TypeScript npmパッケージを含むモノレポ | ルートはPrettierで、2スペース、行幅80、ダブルクォート、セミコロンあり、末尾カンマ`es5`（[.prettierrc](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/.prettierrc)）。UIにはtypescript-eslintの`recommended`設定がある（[eslint.config.js](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/apps/evalite-ui/eslint.config.js)） | ルートCIはbuild、test、選択パッケージの`lint`、`check-format`を実行する（[package.json](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/package.json)、[workflow](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/.github/workflows/ci.yml)）。選択パッケージの`lint`は実質`tsc`（[evalite-tests package.json](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/packages/evalite-tests/package.json)） | 行幅80の根拠を補強する。React専用規則は不要 |
| [`course-video-manager`](https://github.com/mattpocock/course-video-manager/tree/892003a32955fbea606ff63ae7eaefe46ac40dcd) | 2026年8月にも更新されている現行アプリ | Prettierで、2スペース、行幅80、ダブルクォート、セミコロンあり、末尾カンマ`es5`（[.prettierrc](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.prettierrc)）。Huskyとlint-stagedでstaged fileを整形する（[package.json](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/package.json)、[pre-commit](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.husky/pre-commit)） | pre-commitで書式、型、依存境界、独自検査を実行（[pre-commit](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.husky/pre-commit)） | 書式は採る。重いpre-commit運用とアプリ固有検査は採らない |
| [`matt-product-boilerplate`](https://github.com/mattpocock/matt-product-boilerplate/tree/7f352d0777ff118b8964e71c5e3cca9eb43f6f83) | 個人テンプレート。ただしNode 12・TypeScript 3.7時代 | 旧式のESLint 5、typescript-eslint 1、Prettier 1を併用（[package.json](https://github.com/mattpocock/matt-product-boilerplate/blob/7f352d0777ff118b8964e71c5e3cca9eb43f6f83/package.json)） | 書式、ESLint、型、buildを別stepで実行（[workflow](https://github.com/mattpocock/matt-product-boilerplate/blob/7f352d0777ff118b8964e71c5e3cca9eb43f6f83/.github/workflows/main.yml)） | 検査を分ける発想以外は古く、転用しない |

### typescript-eslintから読み取れる範囲

Mattの現行コードでtypescript-eslintを明示的に使う例は、`ai-hero-cli`と`evalite`のUIで確認できた。どちらもrecommended presetを土台にしている（[ai-hero-cli](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs)、[evalite UI](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/apps/evalite-ui/eslint.config.js)）。一方、型情報が必要な`recommendedTypeChecked`は採用していない。

`ai-hero-cli`では`consistent-type-imports`をwarning、TypeScript版`no-unused-vars`をerrorにしているが、`no-explicit-any`、`no-non-null-assertion`、`ban-ts-comment`などは無効化している（[eslint.config.mjs](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs)）。この例外群はEffectベースのCLIに合わせたプロジェクト固有設定であり、pi-formulaへ一括転用する根拠はない。Biomeの`recommended`で問題が出た規則だけを、理由つきで個別調整するほうが安全である。

## pi-formulaへ転用する設定

### 書式は`ts-reset`を主な基準にする

pi-formulaと最も性質が近い`ts-reset`は、小規模な公開TypeScript npmライブラリである。そのPrettier設定は、2スペース、行幅80、ダブルクォート、セミコロンあり、末尾カンマ`all`、アロー関数の括弧`always`である（[package.json](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/package.json)）。`evalite`と`course-video-manager`も、末尾カンマを除けば同じ設定を使っている（[evalite .prettierrc](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/.prettierrc)、[course-video-manager .prettierrc](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.prettierrc)）。

Biomeでは、次の値へ対応づけるのがよい。

```jsonc
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always",
      "bracketSpacing": true
    }
  }
}
```

CommonJSかESMかは、この書式設定に影響しない。pi-formulaのTypeScriptとJavaScriptでクォートを分ける根拠も、今回調べたMattの設定にはない。同じダブルクォートへ統一するほうが、参照元には忠実である。

### `recommended`と`tsc`を併用する

`ai-hero-cli`はESLintとTypeScriptのrecommended presetを使いながら、CIで型チェックも別に実行する（[eslint.config.mjs](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs)、[workflow](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/.github/workflows/ci.yml)）。`ts-reset`と`evalite`も`tsc`を静的検査としてCIへ残している（[ts-reset package.json](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/package.json)、[evalite-tests package.json](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/packages/evalite-tests/package.json)）。

したがって、Biomeの`recommended`を有効にしても、pi-formulaの`tsc --noEmit`は残す。Biomeはコード品質と書式、`tsc`は型とコンパイラ設定、Node testとCucumberは動作仕様を受け持つ。

### `check`で書式・lint・型・テストを通す

`ts-reset`はformat checkをCIへ含め、`ai-hero-cli`は型・lint・testを個別stepで実行する（[ts-reset package.json](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/package.json)、[ai-hero-cli workflow](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/.github/workflows/ci.yml)）。pi-formulaでは、`biome check .`が書式とlintをまとめて検査し、その後に既存の型チェックとテストを実行する構成で十分である。

修正用スクリプトは`biome check --write .`を1本用意すればよい。別に`biome format --write .`を置く場合も、`check`の必須経路は`biome check .`へ統一すると、formatterだけ通してlintを忘れる経路が増えない。

## pi-formulaへ転用しない設定

### ESLintとPrettierは追加しない

MattのリポジトリがESLintとPrettierを使っていても、Biome導入後のpi-formulaへ両方追加する理由にはならない。今回参照したtypescript-eslint設定はReact、Effect、Remotionなど各プロジェクト固有のプラグインを含む（[ai-hero-cli eslint config](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs)、[evalite UI eslint config](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/apps/evalite-ui/eslint.config.js)、[Remotion eslint config](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/apps/remotion-subtitle-renderer/eslint.config.mjs)）。pi-formulaに同じ要件はない。

### `ai-hero-cli`の緩和規則をコピーしない

`no-explicit-any`や`ban-ts-comment`などを無効化した設定は、汎用の推奨値ではない（[eslint.config.mjs](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs)）。まずBiomeのrecommended presetを使い、既存コードとの衝突が正当な設計理由を持つ場合だけ、最小単位で例外を足す。

### モノレポ運用とpre-commit hookは持ち込まない

Total TypeScriptのモノレポはpnpm、Turborepo、Husky、lint-stagedを前提にする（[root package.json](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/package.json)、[turbo.json](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/turbo.json)、[.lintstagedrc](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/.lintstagedrc)）。`course-video-manager`のpre-commitも、書式だけでなく依存境界や独自検査まで実行する（[pre-commit](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.husky/pre-commit)）。単一パッケージのpi-formulaでは、まずnpm scriptと既存CIへBiomeを組み込めば足りる。

### 行幅65は採らない

`ai-hero-cli`だけはPrettierの行幅を65にしている（[package.json](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/package.json)）。一方、公開ライブラリの`ts-reset`、`evalite`、最新の`course-video-manager`は80で揃う（[ts-reset package.json](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/package.json)、[evalite .prettierrc](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/.prettierrc)、[course-video-manager .prettierrc](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.prettierrc)）。pi-formulaには80を採るほうが比較対象との整合性が高い。

## 調査方法と限界

GitHub上のMatt Pocock本人のアカウント`mattpocock`が所有する公開リポジトリを対象に、既定ブランチの`biome`、`@biomejs`、`typescript-eslint`、`eslint`、`prettier`、`lint`を検索した。そのうえで、TypeScriptライブラリ、Total TypeScript系、現行CLI、現行アプリ、個人テンプレートを代表する7リポジトリについて、2026-09-01時点のHEADを固定コミットで読み直した。本文のリンクは、比較結果を後から再現できるよう、原則として固定コミットを指している。

この調査はMattの公開リポジトリから確認できる事実に限る。非公開リポジトリ、ローカル設定、エディタ拡張、未pushの変更は分からない。また、Biomeが見つからなかったことは、MattがBiomeを評価していない、または今後も使わないことを意味しない。確認できるのは、調査対象の現行コードからは再利用可能なBiome設定が得られなかった、という点までである。
