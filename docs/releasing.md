# Publishing to npm

pi-formula starts GitHub Actions from a `vX.Y.Z` tag and uses npm trusted publishing after human approval.

## Publishing setup

Register GitHub Actions as a trusted publisher in the npm package settings.

- Organization or user: `yasuhito`
- Repository: `pi-formula`
- Workflow filename: `release.yml`
- Environment: `npm`
- Allowed actions: `npm publish`

Create the GitHub repository environment `npm` and set a maintainer as its required reviewer. Do not register an npm token in the `npm` environment. `.github/workflows/release.yml` obtains short-lived OpenID Connect credentials with `id-token: write` and attaches provenance with `npm publish --provenance`.

## Prepare release information

`release-metadata.json` is the canonical source for review. Add the new version at the top and finalize the version, date, and bullet order. Align the package and lockfile versions with a command such as `npm version patch --no-git-tag-version`, then generate `CHANGELOG.md` with `npm run changelog:generate`. Do not edit generated files directly. `npm run check` also verifies that generated files are up to date.

Then run `npm run release:prepare -- vX.Y.Z .release`. This runs all checks, creates the tarball, and extracts `release-notes.md` from the generated CHANGELOG in the same order.

## Publish

1. Complete "Prepare release information" above.
2. Run `npm run release:prepare -- vX.Y.Z .release` locally and inspect all checks, the tarball, and `release-notes.md`.
3. Tag the commit to publish with `vX.Y.Z` and push only the tag.
4. GitHub Actions `prepare` rechecks all checks, tag/version agreement, and tarball contents.
5. When `publish` awaits approval for the `npm` environment, a human reviews the version and artifacts and approves.
6. After approval, trusted publishing publishes to npm and creates a GitHub Release titled `pi-formula X.Y.Z`. The Release body uses the CHANGELOG bullets for that version in the same order.

## Post-publication checks

Replace `X.Y.Z` with the published version and run:

```sh
npm view pi-formula@X.Y.Z version dist-tags dist.integrity
git ls-remote origin refs/tags/vX.Y.Z
gh release view vX.Y.Z --json name,tagName,body,url
workdir=$(mktemp -d)
(cd "$workdir" && npm init -y && npm install pi-formula@X.Y.Z && npm audit signatures)
rm -rf "$workdir"
```

Also run `pi install npm:pi-formula@X.Y.Z` in a fresh temporary environment and confirm that Pi can load the extension. Check npm's Provenance display to confirm it originates from `yasuhito/pi-formula`'s `release.yml` and the target tag.

## If authentication or an external service blocks publication

Do not retry when blocked by authentication or permissions for npm, GitHub Actions, GitHub environments, or OpenID Connect. Report the failed stage, error message, and missing prerequisites, and stop publication until a human resolves them.

If only GitHub Release creation fails after npm publication, do not rerun the entire workflow. Do not republish the same npm version; preserve the published npm version and tag and report the missing prerequisites.
