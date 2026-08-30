# Third-party notices and dependency audit

Checked on **2026-08-31**.

## Source provenance

`src/typesetter.ts` and `src/layout.ts` started from code in the MIT-licensed [`yasuhito/qni-cli`](https://github.com/yasuhito/qni-cli) repository:

- source commit: `2f12594e80b9e7baff0c85ecfecb4dd34d06f737`
- original paths: `src/qni-math/typesetter.ts` and `src/qni-math/layout.ts`
- license: MIT
- copyright: Copyright (c) 2020-2026 Yasuhito Takamiya

The imported history is retained in this repository. qni execution, qni tools, temporary-workspace code, and subject-specific macros were not imported.

## Direct runtime dependencies

| Package | Required version | Latest version | Latest release | Update status | License | Known high or critical vulnerabilities |
| --- | --- | --- | --- | --- | --- | --- |
| [`@mathjax/src`](https://github.com/mathjax/MathJax-src) | `^4.1.3` (lockfile: `4.1.3`) | `4.1.3` | 2026-07-03 | Current | Apache-2.0 | None reported by `npm audit --omit=dev` |
| [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js) | `^2.6.2` (lockfile: `2.6.2`) | `2.6.2` | 2026-01-28 | Current | MPL-2.0 | None reported by `npm audit --omit=dev` |

Versions, release dates, and licenses were read from the npm registry with `npm view`. The vulnerability result came from `npm audit --omit=dev`. On 2026-08-31, npm reported **0 low, moderate, high, or critical known vulnerabilities** in the production dependency tree.

The package manager installs each dependency's license with that dependency's source package.
