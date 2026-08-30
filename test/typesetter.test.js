const assert = require('node:assert/strict');
const test = require('node:test');

const { typesetMath } = require('../dist/typesetter.js');

const cell = { widthPx: 10, heightPx: 20 };

test('MathJax display formula becomes a transparent PNG', () => {
  const image = typesetMath('\\frac{1}{\\sqrt{2}}', '#d4d4d4', 80, cell);

  assert.equal(image.png.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(image.png[25], 6, 'PNG must use RGBA color');
  assert.match(image.svg, /<svg/u);
});

test('simple display formula uses 65 percent of the terminal cell height', () => {
  const image = typesetMath('x', '#d4d4d4', 80, cell);
  const ratio = image.heightPx / cell.heightPx;

  assert.ok(ratio >= 0.65 && ratio < 0.70, `unexpected content height ratio: ${ratio}`);
});

test('PNG uses twice the pixel density of its terminal placement', () => {
  const image = typesetMath('x', '#d4d4d4', 80, cell);

  assert.deepEqual(
    { width: image.png.readUInt32BE(16), height: image.png.readUInt32BE(20) },
    { width: image.columns * cell.widthPx * 2, height: image.rows * cell.heightPx * 2 }
  );
});
