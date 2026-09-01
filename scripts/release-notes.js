function extractReleaseNotes(changelog, version) {
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const heading = new RegExp(
    `^## ${escapedVersion}(?:[ \\t][^\\n]*)?(?:\\n|$)`,
    "mu",
  ).exec(changelog);
  if (!heading) return null;

  const followingSections = changelog.slice(heading.index + heading[0].length);
  const nextHeading = /^## (?:[^\n]*)(?:\n|$)/mu.exec(followingSections);
  const sectionEnd = nextHeading?.index ?? followingSections.length;
  const section = followingSections.slice(0, sectionEnd).trim();
  if (!/^- .+$/mu.test(section)) return null;

  return `${section}\n`;
}

module.exports = { extractReleaseNotes };
