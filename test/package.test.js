const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
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
  const sourceDir = join(root, 'src');
  const pending = [sourceDir];
  const files = [];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) pending.push(path);
      else files.push(path);
    }
  }
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');

  assert.ok(files.length > 0);
  assert.doesNotMatch(source, /qni|workdir|registerTool/iu);
});
