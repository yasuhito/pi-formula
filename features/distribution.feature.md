# Feature: Install the npm distribution and check the available contents

Users can consult the npm distribution guidance for display behavior, supported scope, configuration, and safety. The distribution includes necessary user-facing files and can be used as a public API and a Pi extension.

Check the licenses and execution scope of distributed dependencies and verify that native image processing components can actually be loaded.

## Scenario Outline: Each language README provides individual usage guidance

- Given pi-formula English and Japanese READMEs exist
- When inspect user-facing installation, configuration, and supported scope
- Then the <language> README provides <guide> guidance

### Examples:

  | language | guide |
  | --- | --- |
  | english | primaryInstall |
  | japanese | primaryInstall |
  | english | preview |
  | japanese | preview |
  | english | command |
  | japanese | command |
  | english | environmentConfig |
  | japanese | environmentConfig |
  | english | configFile |
  | japanese | configFile |
  | english | ghostty |
  | japanese | ghostty |
  | english | kitty |
  | japanese | kitty |
  | english | linux |
  | japanese | linux |
  | english | macOS |
  | japanese | macOS |
  | english | unsupported |
  | japanese | unsupported |
  | english | coexistence |
  | japanese | coexistence |
  | english | languageLink |
  | japanese | languageLink |

## Scenario: The Pi package image URL points to the Ghostty display sample

- Given pi-formula Pi package metadata exists
- When inspect image metadata
- Then The Pi package image URL points to the Ghostty display sample

## Scenario: The Ghostty display sample is a PNG

- Given pi-formula Pi package metadata exists
- When inspect image metadata
- Then The Ghostty display sample is a PNG

## Scenario: Include only user-facing files in the npm tarball

- When create the pi-formula npm tarball
- And inspect the tarball file list
- Then Only src, dist, both READMEs, LICENSE, CHANGELOG, third-party notices, and the display sample are distributed

## Scenario: Include the Ghostty display sample in the npm tarball

- When create the pi-formula npm tarball
- And inspect the tarball file list
- Then The Ghostty display sample is distributed

## Scenario: The build succeeds even in a checkout with stale artifacts

- Given stale artifacts for deleted sources exist
- When build pi-formula
- Then The build succeeds even in a checkout with stale artifacts

## Scenario: The generated dist retains no artifacts for deleted sources

- Given stale artifacts for deleted sources exist
- When build pi-formula
- Then The generated dist retains no artifacts for deleted sources

## Scenario: Exclude stale artifacts for deleted sources from the npm tarball

- Given stale artifacts for deleted sources exist
- When create the pi-formula npm tarball
- And inspect the tarball file list
- Then The tarball does not distribute stale artifacts

## Scenario: The installed package extension registration API is callable

- Given a fresh npm installation directory exists for testing the public API
- When create the public API test tarball
- And install the public API test tarball with npm
- And load the installed package root
- Then The installed package extension registration API is callable

## Scenario: The installed package PNG creation API is callable

- Given a fresh npm installation directory exists for testing the public API
- When create the public API test tarball
- And install the public API test tarball with npm
- And load the installed package root
- Then The installed package PNG creation API is callable

## Scenario: Do not expose internal subpaths in the npm tarball

- Given a fresh npm installation directory exists for testing the public API
- When create the public API test tarball
- And install the public API test tarball with npm
- And load the installed package internal Markdown subpath
- Then Internal subpaths are not exported

## Scenario: The release candidate npm pack succeeds

- Given a fresh installation directory and user settings exist for testing real Pi
- When create the release candidate tarball
- And install the release candidate tarball into real Pi
- And inspect the origins of Resvg and the public API in the installed distribution
- And query the real Pi command list in the installation directory
- Then The release candidate npm pack succeeds

## Scenario: Installing the release candidate into Pi succeeds

- Given a fresh installation directory and user settings exist for testing real Pi
- When create the release candidate tarball
- And install the release candidate tarball into real Pi
- And inspect the origins of Resvg and the public API in the installed distribution
- And query the real Pi command list in the installation directory
- Then Installing the release candidate into Pi succeeds

## Scenario: The installed distribution Resvg check succeeds

- Given a fresh installation directory and user settings exist for testing real Pi
- When create the release candidate tarball
- And install the release candidate tarball into real Pi
- And inspect the origins of Resvg and the public API in the installed distribution
- And query the real Pi command list in the installation directory
- Then The installed distribution Resvg check succeeds

## Scenario: The public API is loaded from the distribution installed in the temporary environment

- Given a fresh installation directory and user settings exist for testing real Pi
- When create the release candidate tarball
- And install the release candidate tarball into real Pi
- And inspect the origins of Resvg and the public API in the installed distribution
- And query the real Pi command list in the installation directory
- Then The public API is loaded from the distribution installed in the temporary environment

## Scenario: The native Resvg component is loaded from the distribution installed in the temporary environment

- Given a fresh installation directory and user settings exist for testing real Pi
- When create the release candidate tarball
- And install the release candidate tarball into real Pi
- And inspect the origins of Resvg and the public API in the installed distribution
- And query the real Pi command list in the installation directory
- Then The native Resvg component is loaded from the distribution installed in the temporary environment

## Scenario: The installed native Resvg component supports the current OS and CPU

- Given a fresh installation directory and user settings exist for testing real Pi
- When create the release candidate tarball
- And install the release candidate tarball into real Pi
- And inspect the origins of Resvg and the public API in the installed distribution
- And query the real Pi command list in the installation directory
- Then The installed native Resvg component supports the current OS and CPU

## Scenario: The installed Resvg can create PNG data

- Given a fresh installation directory and user settings exist for testing real Pi
- When create the release candidate tarball
- And install the release candidate tarball into real Pi
- And inspect the origins of Resvg and the public API in the installed distribution
- And query the real Pi command list in the installation directory
- Then The installed Resvg can create PNG data

## Scenario: Real Pi exits after inspecting the distribution

- Given a fresh installation directory and user settings exist for testing real Pi
- When create the release candidate tarball
- And install the release candidate tarball into real Pi
- And inspect the origins of Resvg and the public API in the installed distribution
- And query the real Pi command list in the installation directory
- Then Real Pi exits after inspecting the distribution

## Scenario: The real Pi command list response does not time out

- Given a fresh installation directory and user settings exist for testing real Pi
- When create the release candidate tarball
- And install the release candidate tarball into real Pi
- And inspect the origins of Resvg and the public API in the installed distribution
- And query the real Pi command list in the installation directory
- Then The real Pi command list response does not time out

## Scenario: Real Pi discovers the installed formula command

- Given a fresh installation directory and user settings exist for testing real Pi
- When create the release candidate tarball
- And install the release candidate tarball into real Pi
- And inspect the origins of Resvg and the public API in the installed distribution
- And query the real Pi command list in the installation directory
- Then Real Pi discovers the installed formula command

## Scenario: The package license is MIT

- Given pi-formula license and third-party notices exist
- When inspect origins, versions, update status, licenses, and known vulnerabilities
- Then The package license is MIT

## Scenario: Third-party notices identify the imported qni-cli commit

- Given pi-formula license and third-party notices exist
- When inspect origins, versions, update status, licenses, and known vulnerabilities
- Then Third-party notices identify the imported qni-cli commit

## Scenario: The dependency audit date is August 31, 2026

- Given pi-formula license and third-party notices exist
- When inspect origins, versions, update status, licenses, and known vulnerabilities
- Then The dependency audit date is August 31, 2026

## Scenario: The audited direct dependencies match the package metadata

- Given pi-formula license and third-party notices exist
- When inspect origins, versions, update status, licenses, and known vulnerabilities
- Then The audited direct dependencies match the package metadata

## Scenario: All direct dependencies are included in the audit table

- Given pi-formula license and third-party notices exist
- When inspect origins, versions, update status, licenses, and known vulnerabilities
- Then All direct dependencies are included in the audit table

## Scenario: An audit table of direct dependency versions, update status, and licenses is maintained

- Given pi-formula license and third-party notices exist
- When inspect origins, versions, update status, licenses, and known vulnerabilities
- Then The direct dependency audit records are as follows

  | component | declared version | checked version | release date | update status | license | vulnerabilities |
  | --- | --- | --- | --- | --- | --- | --- |
  | @mathjax/src | `^4.1.3` (lockfile: `4.1.3`) | `4.1.3` | 2026-07-03 | Current | Apache-2.0 | None (`npm audit`) |
  | @resvg/resvg-js | `^2.6.2` (lockfile: `2.6.2`) | `2.6.2` | 2024-03-26 | Current stable; next `2.7.0-alpha.2` (2026-01-28) | MPL-2.0 | None (`npm audit`) |
  | @earendil-works/pi-coding-agent | `*` (verified: `0.84.4`) | `0.84.4` | 2026-08-28 | Current | MIT | None (`npm audit`) |
  | @earendil-works/pi-tui | `*` (verified: `0.84.4`) | `0.84.4` | 2026-08-28 | Current | MIT | None (`npm audit`) |
