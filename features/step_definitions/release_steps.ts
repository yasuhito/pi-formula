interface StepWorld {
  changelog: string;
  changelogVersion: string;
  preparation: import("node:child_process").SpawnSyncReturns<string>;
  releaseDirectory: string;
  releaseNotes: string | null;
  releaseTag: string;
  similarVersionChangelog: string;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const {
  mkdtempSync,
  readFileSync,
  rmSync,
}: typeof import("node:fs") = require("node:fs");
const { tmpdir }: typeof import("node:os") = require("node:os");
const { join, resolve }: typeof import("node:path") = require("node:path");
const {
  spawnSync,
}: typeof import("node:child_process") = require("node:child_process");
const {
  After,
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");
const {
  extractReleaseNotes,
}: typeof import("../../scripts/release-notes") = require("../../scripts/release-notes");

const root = resolve(__dirname, "../..");
const readProjectFile = (path: string) =>
  readFileSync(join(root, path), "utf8");

After(function (this: StepWorld) {
  if (this.releaseDirectory) {
    rmSync(this.releaseDirectory, { recursive: true, force: true });
  }
});

Given(
  "a release tag differs from the package.json version",
  function (this: StepWorld) {
    this.releaseTag = "v9.9.9";
  },
);

Given(
  "a release tag matches the package.json version",
  function (this: StepWorld) {
    const manifest = JSON.parse(readProjectFile("package.json"));
    this.releaseTag = `v${manifest.version}`;
  },
);

When("run release preparation", function (this: StepWorld) {
  this.releaseDirectory = mkdtempSync(join(tmpdir(), "pi-formula-release-"));
  this.preparation = spawnSync(
    process.execPath,
    ["scripts/prepare-release.js", this.releaseTag, this.releaseDirectory],
    { cwd: root, encoding: "utf8" },
  );
});

Then(
  "Release preparation for a mismatched version tag returns exit code 1",
  function (this: StepWorld) {
    assert.deepEqual(this.preparation.status, 1);
  },
);

Then(
  "Release preparation reports a package version and tag mismatch",
  function (this: StepWorld) {
    assert.deepEqual(
      /does not match package\.json version/u.test(this.preparation.stderr),
      true,
    );
  },
);

Then(
  "Release preparation for a mismatched version tag creates no distribution files",
  function (this: StepWorld) {
    assert.deepEqual(require("node:fs").readdirSync(this.releaseDirectory), []);
  },
);

Then(
  "Release preparation with matching versions succeeds",
  function (this: StepWorld) {
    assert.deepEqual(this.preparation.status, 0);
  },
);

Then(
  "Release preparation produces a tarball and release notes for the same version",
  function (this: StepWorld) {
    const manifest = JSON.parse(readProjectFile("package.json"));
    const files = require("node:fs").readdirSync(this.releaseDirectory).sort();
    assert.deepEqual(files, [
      `pi-formula-${manifest.version}.tgz`,
      "release-notes.md",
    ]);
  },
);

Then(
  "The release notes match the CHANGELOG body for the same version",
  function (this: StepWorld) {
    const manifest = JSON.parse(readProjectFile("package.json"));
    const changelogLines = readProjectFile("CHANGELOG.md").split("\n");
    const headingIndex = changelogLines.findIndex(
      (line) =>
        line === `## ${manifest.version}` ||
        line.startsWith(`## ${manifest.version} `),
    );
    const bulletLines = changelogLines.slice(headingIndex + 2);
    const firstNonBullet = bulletLines.findIndex(
      (line) => !line.startsWith("- "),
    );
    const bulletEnd =
      firstNonBullet === -1 ? bulletLines.length : firstNonBullet;
    const expectedNotes = `${bulletLines.slice(0, bulletEnd).join("\n")}\n`;
    const notes = readFileSync(
      join(this.releaseDirectory, "release-notes.md"),
      "utf8",
    );
    assert.deepEqual(notes, expectedNotes);
  },
);

Given(
  "the CHANGELOG contains only another version starting with the current version",
  function (this: StepWorld) {
    this.similarVersionChangelog = [
      "## 0.1.00 - Unreleased",
      "",
      "- Wrong numeric version.",
      "",
      "## 0.1.0x - Unreleased",
      "",
      "- Wrong suffix version.",
      "",
    ].join("\n");
  },
);

When(
  "extract the Release body for the current version",
  function (this: StepWorld) {
    this.releaseNotes = extractReleaseNotes(
      this.similarVersionChangelog,
      "0.1.0",
    );
  },
);

Then(
  "No Release body is found for the current version",
  function (this: StepWorld) {
    assert.equal(this.releaseNotes, null);
  },
);

Given(
  "the CHANGELOG contains a bullet with continuation lines followed by another bullet",
  function (this: StepWorld) {
    this.changelog = [
      "## 0.1.0 - Unreleased",
      "",
      "- First change",
      "  continues on the next line.",
      "",
      "- Second change",
      "  also continues.",
      "",
      "## 0.2.0 - Unreleased",
      "",
      "- Later release.",
      "",
    ].join("\n");
    this.changelogVersion = "0.1.0";
  },
);

Given(
  "a CHANGELOG version contains only empty bullets",
  function (this: StepWorld) {
    this.changelog = "## 0.1.0 - Unreleased\n\n- \n";
    this.changelogVersion = "0.1.0";
  },
);

When("extract the Release body for that version", function (this: StepWorld) {
  this.releaseNotes = extractReleaseNotes(
    this.changelog,
    this.changelogVersion,
  );
});

Then(
  "Continuation lines and the following bullet retain their order",
  function (this: StepWorld) {
    assert.equal(
      this.releaseNotes,
      [
        "- First change",
        "  continues on the next line.",
        "",
        "- Second change",
        "  also continues.",
        "",
      ].join("\n"),
    );
  },
);

Then("No Release body is found", function (this: StepWorld) {
  assert.equal(this.releaseNotes, null);
});
