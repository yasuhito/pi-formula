# Feature: Prepare the pi-formula release

Maintainers check the version and distribution files before publishing. Release preparation rejects mismatched tags and produces a tarball and release notes for the matching version.

## Scenario: Release preparation for a mismatched version tag returns exit code 1

- Given a release tag differs from the package.json version
- When run release preparation
- Then Release preparation for a mismatched version tag returns exit code 1

## Scenario: Release preparation reports a package version and tag mismatch

- Given a release tag differs from the package.json version
- When run release preparation
- Then Release preparation reports a package version and tag mismatch

## Scenario: Release preparation for a mismatched version tag creates no distribution files

- Given a release tag differs from the package.json version
- When run release preparation
- Then Release preparation for a mismatched version tag creates no distribution files

## Scenario: Release preparation with matching versions succeeds

- Given a release tag matches the package.json version
- When run release preparation
- Then Release preparation with matching versions succeeds

## Scenario: Release preparation produces a tarball and release notes for the same version

- Given a release tag matches the package.json version
- When run release preparation
- Then Release preparation produces a tarball and release notes for the same version

## Scenario: The release notes match the CHANGELOG body for the same version

- Given a release tag matches the package.json version
- When run release preparation
- Then The release notes match the CHANGELOG body for the same version

## Scenario: Do not treat a similar CHANGELOG version heading as the current version

- Given the CHANGELOG contains only another version starting with the current version
- When extract the Release body for the current version
- Then No Release body is found for the current version

## Scenario: Preserve multiline CHANGELOG bullets

- Given the CHANGELOG contains a bullet with continuation lines followed by another bullet
- When extract the Release body for that version
- Then Continuation lines and the following bullet retain their order

## Scenario: Reject empty CHANGELOG bullets

- Given a CHANGELOG version contains only empty bullets
- When extract the Release body for that version
- Then No Release body is found
