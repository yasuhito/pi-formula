#!/usr/bin/env node

const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const tag = process.argv[2];
const outputDirectory = resolve(process.argv[3] ?? join(root, '.release'));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const expectedTag = `v${manifest.version}`;

function fail(message) {
  process.stderr.write(`Release preparation failed: ${message}\n`);
  process.exit(1);
}

if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(tag ?? '')) {
  fail('tag must have the form vX.Y.Z');
}
if (tag !== expectedTag) {
  fail(`tag ${tag} does not match package.json version ${manifest.version}`);
}

const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
const escapedVersion = manifest.version.replaceAll('.', '\\.');
const section = new RegExp(`^## ${escapedVersion}[^\\n]*\\n\\n((?:- .+\\n?)+)`, 'mu').exec(changelog);
if (!section) {
  fail(`CHANGELOG.md has no bullet list for ${manifest.version}`);
}
const releaseNotes = `${section[1].trimEnd()}\n`;

mkdirSync(outputDirectory, { recursive: true });
const packed = spawnSync('npm', ['pack', '--json', '--pack-destination', outputDirectory], {
  cwd: root,
  encoding: 'utf8'
});
if (packed.status !== 0) {
  fail(packed.stderr.trim() || 'npm pack failed');
}

let packResult;
try {
  const output = JSON.parse(packed.stdout);
  packResult = Array.isArray(output) ? output[0] : (output[manifest.name] ?? output);
} catch {
  fail('npm pack did not return JSON');
}

const topLevel = [...new Set(packResult.files.map(({ path }) => path.split('/')[0]))].sort();
const expectedTopLevel = [
  'CHANGELOG.md',
  'LICENSE',
  'README.ja.md',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'assets',
  'dist',
  'package.json',
  'src'
];
if (JSON.stringify(topLevel) !== JSON.stringify(expectedTopLevel)) {
  fail(`unexpected tarball contents: ${topLevel.join(', ')}`);
}

writeFileSync(join(outputDirectory, 'release-notes.md'), releaseNotes);
process.stdout.write(`Prepared ${packResult.filename} for pi-formula ${manifest.version}\n`);
