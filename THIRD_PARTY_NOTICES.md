# Third-party notices and dependency audit

Checked on **2026-08-31**.

## Source provenance

`src/typesetter.ts` and `src/layout.ts` started from code in the MIT-licensed [`yasuhito/qni-cli`](https://github.com/yasuhito/qni-cli) repository:

- source commit: `2f12594e80b9e7baff0c85ecfecb4dd34d06f737`
- original paths: `src/qni-math/typesetter.ts` and `src/qni-math/layout.ts`
- license: MIT
- copyright: Copyright (c) 2020-2026 Yasuhito Takamiya

The imported history is retained in this repository. qni execution, qni tools, temporary-workspace code, and subject-specific macros were not imported.

## Direct runtime and host dependencies

The first two rows are npm runtime dependencies. The last two are direct peer dependencies supplied by the Pi host. Their verified versions are the versions in this package's development lockfile.

| Package | Required or verified version | Latest version | Latest release | Update status | License | Known high or critical vulnerabilities |
| --- | --- | --- | --- | --- | --- | --- |
| [`@mathjax/src`](https://github.com/mathjax/MathJax-src) | `^4.1.3` (lockfile: `4.1.3`) | `4.1.3` | 2026-07-03 | Current | Apache-2.0 | None (`npm audit`) |
| [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js) | `^2.6.2` (lockfile: `2.6.2`) | `2.6.2` | 2024-03-26 | Current stable; next `2.7.0-alpha.2` (2026-01-28) | MPL-2.0 | None (`npm audit`) |
| [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) | `*` (verified: `0.84.4`) | `0.84.4` | 2026-08-28 | Current | MIT | None (`npm audit`) |
| [`@earendil-works/pi-tui`](https://www.npmjs.com/package/@earendil-works/pi-tui) | `*` (verified: `0.84.4`) | `0.84.4` | 2026-08-28 | Current | MIT | None (`npm audit`) |

Versions, dist-tags, release dates, and licenses were read from the npm registry with `npm view`. `npm audit` checked the complete lockfile, including the verified Pi host packages; `npm audit --omit=dev` separately checked the installed production tree. On 2026-08-31, both commands reported **0 low, moderate, high, or critical known vulnerabilities**.

The package manager installs each dependency's license with that dependency's source package.
