# Feature: Install the npm distribution and check the available contents

The distribution includes necessary user-facing files and can be used as a public API and a Pi extension. Verify that native image processing components can actually be loaded.

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
- Then Only src, dist, the English README, LICENSE, CHANGELOG, third-party notices, and the display sample are distributed

## Scenario: Include the English README in the npm tarball

- When create the pi-formula npm tarball
- And inspect the tarball file list
- Then The English README is distributed

## Scenario: Exclude the Japanese README from the npm tarball

- When create the pi-formula npm tarball
- And inspect the tarball file list
- Then The Japanese README is not distributed

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
