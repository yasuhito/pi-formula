# Feature: Publish pi-formula with approval

Maintainers publish pi-formula after checking the version and distribution files without leaving secrets behind. Each publishing stage checks approval and verification results and does not proceed after a failed step.

Release notes and provenance verify that the published artifact originates from an approved GitHub release.

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

## Scenario: The release preparation command passes all checks before creating distribution files

- Given a release tag matches the package.json version
- When run release preparation
- Then The release preparation command passes all checks before creating distribution files

## Scenario: Release preparation produces a tarball and release notes for the same version

- Given a release tag matches the package.json version
- When run release preparation
- Then Release preparation produces a tarball and release notes for the same version

## Scenario: The publish workflow uses the release preparation command

- Given a release tag matches the package.json version
- When run release preparation
- Then The publish workflow uses the release preparation command

## Scenario: The publish workflow starts on version tag pushes

- Given GitHub Actions for npm publishing exist
- When inspect publish job permissions and environment
- Then The publish workflow starts on version tag pushes

## Scenario: The publish workflow uses the npm environment for approval

- Given GitHub Actions for npm publishing exist
- When inspect publish job permissions and environment
- Then The publish workflow uses the npm environment for approval

## Scenario: The npm environment documents npm publish as the permitted operation

- Given GitHub Actions for npm publishing exist
- When inspect publish job permissions and environment
- Then The npm environment documents npm publish as the permitted operation

## Scenario: The publish workflow has permission to issue OIDC tokens

- Given GitHub Actions for npm publishing exist
- When inspect publish job permissions and environment
- Then The publish workflow has permission to issue OIDC tokens

## Scenario: The npm publish includes provenance

- Given GitHub Actions for npm publishing exist
- When inspect publish job permissions and environment
- Then The npm publish includes provenance

## Scenario: The publish workflow does not configure an npm token

- Given GitHub Actions for npm publishing exist
- When inspect publish job permissions and environment
- Then The publish workflow does not configure an npm token

## Scenario: The release notes match the CHANGELOG body for the same version

- Given a release tag matches the package.json version
- When run release preparation
- Then The release notes match the CHANGELOG body for the same version

## Scenario: The Release title contains the package version

- Given a release tag matches the package.json version
- When run release preparation
- Then The Release title contains the package version

## Scenario: The Release body uses release notes for the same version

- Given a release tag matches the package.json version
- When run release preparation
- Then The Release body uses release notes for the same version

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

## Scenario: A procedure verifies the npm version after publishing

- Given ongoing publishing procedures exist
- When inspect post-publish and publish failure procedures
- Then A procedure verifies the npm version after publishing

## Scenario: A procedure verifies the remote tag after publishing

- Given ongoing publishing procedures exist
- When inspect post-publish and publish failure procedures
- Then A procedure verifies the remote tag after publishing

## Scenario: A procedure verifies the GitHub Release after publishing

- Given ongoing publishing procedures exist
- When inspect post-publish and publish failure procedures
- Then A procedure verifies the GitHub Release after publishing

## Scenario: A procedure verifies provenance after publishing

- Given ongoing publishing procedures exist
- When inspect post-publish and publish failure procedures
- Then A procedure verifies provenance after publishing

## Scenario: Publishing with missing external prerequisites is documented as not retryable

- Given ongoing publishing procedures exist
- When inspect post-publish and publish failure procedures
- Then Publishing with missing external prerequisites is documented as not retryable

## Scenario: A procedure reports missing publishing prerequisites

- Given ongoing publishing procedures exist
- When inspect post-publish and publish failure procedures
- Then A procedure reports missing publishing prerequisites
