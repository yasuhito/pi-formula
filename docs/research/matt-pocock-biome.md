# Evaluating Biome configuration from Matt Pocock's public repositories

Research date: 2026-09-01

## Conclusion

No directly reusable Biome configuration was found in Matt Pocock's current repositories. The seven representative repositories examined use Prettier for formatting and TypeScript or ESLint for static checks. Although `course-video-manager` has two `biome-ignore` comments, it has no Biome configuration, dependency, or execution script ([tree at the examined commit](https://github.com/mattpocock/course-video-manager/tree/892003a32955fbea606ff63ae7eaefe46ac40dcd), [package.json](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/package.json), [comment example](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/apps/local/components/ui/kibo-ui/code-block/server.tsx)). Those comments alone do not establish Biome adoption.

Therefore, pi-formula should not reproduce a "Matt Pocock Biome preset". It is reasonable to transfer only the **formatting preferences and separation of CI responsibilities** consistently observed in his repositories, using Biome's `recommended` as the linting baseline.

Settings to adopt in pi-formula:

- Two spaces, line width 80, double quotes, semicolons, and bracket spacing
- Trailing commas `all`, arrow function parentheses `always`
- Include `biome check .` in the CI-equivalent `check`, retaining type checks and tests as separate steps
- Enable Biome `recommended`; do not replace TypeScript `strict` with Biome
- Pin the Biome version and configuration `$schema` to the same version

Do not import pnpm, Turborepo, Husky, lint-staged, React/Effect ESLint plugins, or Matt-specific exceptions. Their operational overhead outweighs their value for pi-formula, a small CommonJS library.

## Current repositories use Prettier, TypeScript, and ESLint, not Biome

### Comparison

| Repository | Role / relevance | Formatting / static checks | CI execution | Implications for pi-formula |
| --- | --- | --- | --- | --- |
| [`ts-reset`](https://github.com/mattpocock/ts-reset/tree/81b3b2614a32e47948cd4b8d5468879c07c2b361) | Public TypeScript npm library; closest comparison | `lint` is `tsc`. Prettier uses two spaces, line width 80, double quotes, semicolons, trailing commas `all` ([package.json](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/package.json)) | Runs `build`, export map checks, `tsc`, custom package.json checks, and `format:check` together ([workflow](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/.github/workflows/main.yml)) | Adopt formatting and the separation of type, format, and package checks |
| [`total-typescript-monorepo`](https://github.com/mattpocock/total-typescript-monorepo/tree/fd2f2802c859a5880eec8ad9f035d02583946d04) | Current Total TypeScript monorepo | Root uses Prettier, formatting staged files with `prettier --ignore-unknown --write` ([package.json](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/package.json), [.lintstagedrc](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/.lintstagedrc)). Only some Remotion apps have specific ESLint configuration ([eslint.config.mjs](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/apps/remotion-subtitle-renderer/eslint.config.mjs)) | GitHub Actions calls `pnpm run ci`, running `build test lint` with Turborepo ([package.json](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/package.json), [workflow](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/.github/workflows/ci.yml)) | Adopt only bundling required checks under one `check`; no monorepo infrastructure needed |
| [`total-typescript-monorepo-template`](https://github.com/mattpocock/total-typescript-monorepo-template/tree/fc7cd055eac9acd69ef111b44ccd93dc0b99d05f) | Matt's own monorepo template, last updated in 2024 | Root has a Prettier dependency. Example package scripts use only `tsc` and Vitest, with neither Biome nor ESLint ([root package.json](https://github.com/mattpocock/total-typescript-monorepo-template/blob/fc7cd055eac9acd69ef111b44ccd93dc0b99d05f/package.json), [example package](https://github.com/mattpocock/total-typescript-monorepo-template/blob/fc7cd055eac9acd69ef111b44ccd93dc0b99d05f/packages/_example-package/package.json)) | `turbo build test lint` ([package.json](https://github.com/mattpocock/total-typescript-monorepo-template/blob/fc7cd055eac9acd69ef111b44ccd93dc0b99d05f/package.json), [workflow](https://github.com/mattpocock/total-typescript-monorepo-template/blob/fc7cd055eac9acd69ef111b44ccd93dc0b99d05f/.github/workflows/ci.yml)) | Not a Biome reference; do not copy the old template's tooling either |
| [`ai-hero-cli`](https://github.com/mattpocock/ai-hero-cli/tree/ffdd3900d6c0740b1d18f1845dd3caf829d234b0) | Current TypeScript CLI / npm package | ESLint 9 flat config uses `eslint:recommended` and `@typescript-eslint/recommended`, with additional checks for unused variables and type-only imports ([eslint.config.mjs](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs)). Prettier uses line width 65 and two spaces ([package.json](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/package.json)) | Type checks, ESLint, and tests run in separate steps; no format check in CI ([workflow](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/.github/workflows/ci.yml)) | Start from `recommended` and retain separate type checks; do not adopt Effect/custom syntax rules |
| [`evalite`](https://github.com/mattpocock/evalite/tree/e18a793789400b9292f92465d1084344340aef9b) | Monorepo containing current TypeScript npm packages | Root Prettier uses two spaces, line width 80, double quotes, semicolons, trailing commas `es5` ([.prettierrc](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/.prettierrc)). UI has typescript-eslint `recommended` ([eslint.config.js](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/apps/evalite-ui/eslint.config.js)) | Root CI runs build, test, selected packages' `lint`, and `check-format` ([package.json](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/package.json), [workflow](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/.github/workflows/ci.yml)). Selected packages' `lint` is effectively `tsc` ([evalite-tests package.json](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/packages/evalite-tests/package.json)) | Supports line width 80; no React-specific rules needed |
| [`course-video-manager`](https://github.com/mattpocock/course-video-manager/tree/892003a32955fbea606ff63ae7eaefe46ac40dcd) | Current app updated as recently as August 2026 | Prettier uses two spaces, line width 80, double quotes, semicolons, trailing commas `es5` ([.prettierrc](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.prettierrc)). Husky and lint-staged format staged files ([package.json](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/package.json), [pre-commit](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.husky/pre-commit)) | Pre-commit runs formatting, types, dependency boundaries, and custom checks ([pre-commit](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.husky/pre-commit)) | Adopt formatting, not heavy pre-commit operations or app-specific checks |
| [`matt-product-boilerplate`](https://github.com/mattpocock/matt-product-boilerplate/tree/7f352d0777ff118b8964e71c5e3cca9eb43f6f83) | Personal template from the Node 12 / TypeScript 3.7 era | Old ESLint 5, typescript-eslint 1, and Prettier 1 together ([package.json](https://github.com/mattpocock/matt-product-boilerplate/blob/7f352d0777ff118b8964e71c5e3cca9eb43f6f83/package.json)) | Formatting, ESLint, types, and build in separate steps ([workflow](https://github.com/mattpocock/matt-product-boilerplate/blob/7f352d0777ff118b8964e71c5e3cca9eb43f6f83/.github/workflows/main.yml)) | Too old to adopt beyond separation of checks |

### What typescript-eslint usage shows

Explicit typescript-eslint usage in Matt's current code was confirmed in `ai-hero-cli` and the `evalite` UI. Both build on the recommended preset ([ai-hero-cli](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs), [evalite UI](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/apps/evalite-ui/eslint.config.js)). Neither adopts `recommendedTypeChecked`, which requires type information.

`ai-hero-cli` sets `consistent-type-imports` to warning and the TypeScript `no-unused-vars` to error, but disables `no-explicit-any`, `no-non-null-assertion`, `ban-ts-comment`, and others ([eslint.config.mjs](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs)). These exceptions are project-specific to an Effect-based CLI and do not justify wholesale adoption in pi-formula. It is safer to adjust only problematic Biome `recommended` rules individually, with reasons.

## Settings to adopt in pi-formula

### Use `ts-reset` as the main formatting reference

The closest match, `ts-reset`, is a small public TypeScript npm library. Its Prettier settings are two spaces, line width 80, double quotes, semicolons, trailing commas `all`, and arrow parentheses `always` ([package.json](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/package.json)). `evalite` and `course-video-manager` use the same settings except for trailing commas ([evalite .prettierrc](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/.prettierrc), [course-video-manager .prettierrc](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.prettierrc)).

Map these to Biome as follows:

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

CommonJS versus ESM does not affect these formatting settings. Matt's configurations examined here give no reason to use different quotes for pi-formula's TypeScript and JavaScript. Consistent double quotes better reflect the references.

### Use `recommended` together with `tsc`

`ai-hero-cli` uses ESLint and TypeScript recommended presets while retaining separate type checks in CI ([eslint.config.mjs](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs), [workflow](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/.github/workflows/ci.yml)). `ts-reset` and `evalite` also retain `tsc` as a static CI check ([ts-reset package.json](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/package.json), [evalite-tests package.json](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/packages/evalite-tests/package.json)).

Thus, retain pi-formula's `tsc --noEmit` even with Biome `recommended` enabled. Biome handles code quality and formatting, `tsc` handles types and compiler settings, and Node tests and Cucumber cover behavioral specifications.

### Run formatting, lint, types, and tests through `check`

`ts-reset` includes format checks in CI, while `ai-hero-cli` runs types, lint, and tests as individual steps ([ts-reset package.json](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/package.json), [ai-hero-cli workflow](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/.github/workflows/ci.yml)). For pi-formula, `biome check .` covering formatting and lint followed by existing type checks and tests is sufficient.

One fix script using `biome check --write .` is enough. Even if a separate `biome format --write .` exists, standardize the required `check` path on `biome check .` to avoid extra paths that run the formatter but forget lint.

## Settings not to adopt in pi-formula

### Do not add ESLint and Prettier

Matt's repositories using ESLint and Prettier does not justify adding both to pi-formula after Biome adoption. The typescript-eslint configurations examined contain project-specific plugins for React, Effect, Remotion, and others ([ai-hero-cli eslint config](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs), [evalite UI eslint config](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/apps/evalite-ui/eslint.config.js), [Remotion eslint config](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/apps/remotion-subtitle-renderer/eslint.config.mjs)). pi-formula does not share those requirements.

### Do not copy `ai-hero-cli`'s relaxed rules

Disabling rules such as `no-explicit-any` and `ban-ts-comment` is not a general recommendation ([eslint.config.mjs](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/eslint.config.mjs)). Start with Biome's recommended preset; add exceptions at the smallest scope only when conflicts with existing code have legitimate design reasons.

### Do not import monorepo operations or pre-commit hooks

Total TypeScript's monorepo assumes pnpm, Turborepo, Husky, and lint-staged ([root package.json](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/package.json), [turbo.json](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/turbo.json), [.lintstagedrc](https://github.com/mattpocock/total-typescript-monorepo/blob/fd2f2802c859a5880eec8ad9f035d02583946d04/.lintstagedrc)). `course-video-manager`'s pre-commit also runs dependency-boundary and custom checks beyond formatting ([pre-commit](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.husky/pre-commit)). For single-package pi-formula, integrating Biome into npm scripts and existing CI is enough to start.

### Do not adopt line width 65

Only `ai-hero-cli` sets Prettier line width to 65 ([package.json](https://github.com/mattpocock/ai-hero-cli/blob/ffdd3900d6c0740b1d18f1845dd3caf829d234b0/package.json)). Public libraries `ts-reset` and `evalite`, and the latest `course-video-manager`, agree on 80 ([ts-reset package.json](https://github.com/mattpocock/ts-reset/blob/81b3b2614a32e47948cd4b8d5468879c07c2b361/package.json), [evalite .prettierrc](https://github.com/mattpocock/evalite/blob/e18a793789400b9292f92465d1084344340aef9b/.prettierrc), [course-video-manager .prettierrc](https://github.com/mattpocock/course-video-manager/blob/892003a32955fbea606ff63ae7eaefe46ac40dcd/.prettierrc)). Adopting 80 for pi-formula better aligns with the comparison set.

## Method and limitations

Searched public repositories owned by Matt Pocock's GitHub account `mattpocock` for `biome`, `@biomejs`, `typescript-eslint`, `eslint`, `prettier`, and `lint` on default branches. Then reread seven representative repositories covering TypeScript libraries, Total TypeScript projects, current CLIs, current apps, and personal templates at pinned HEAD commits as of 2026-09-01. Links generally point to pinned commits so the comparison can be reproduced later.

This research is limited to facts visible in Matt's public repositories. It cannot establish private repositories, local settings, editor extensions, or unpushed changes. Failure to find Biome does not mean Matt has not evaluated it or will never use it. It establishes only that the current code examined did not yield a reusable Biome configuration.
