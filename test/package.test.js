const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const test = require('node:test');

const root = resolve(__dirname, '..');

test('package exposes a CommonJS typesetter', () => {
  const manifest = require(join(root, 'package.json'));
  const exported = require(root);

  assert.equal(manifest.type, 'commonjs');
  assert.equal(typeof exported.typesetMath, 'function');
});

test('source contains no qni-specific execution modules', () => {
  const files = readdirSync(join(root, 'src'));
  const source = files.map((file) => readFileSync(join(root, 'src', file), 'utf8')).join('\n');

  assert.deepEqual(files.sort(), ['layout.ts', 'typesetter.ts']);
  assert.doesNotMatch(source, /qni|workdir|registerTool/iu);
});
