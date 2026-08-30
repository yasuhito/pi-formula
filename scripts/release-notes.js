function extractReleaseNotes(changelog, version) {
  const escapedVersion = version.replaceAll('.', '\\.');
  const section = new RegExp(
    `^## ${escapedVersion}(?:[ \\t][^\\n]*)?\\n\\n((?:- .+\\n?)+)`,
    'mu'
  ).exec(changelog);

  return section ? `${section[1].trimEnd()}\n` : null;
}

module.exports = { extractReleaseNotes };
