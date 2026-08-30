const assert = require('node:assert/strict');
const test = require('node:test');
const { inflateSync } = require('node:zlib');

const { typesetMath } = require('../dist/typesetter.js');

const cell = { widthPx: 10, heightPx: 20 };

test('MathJax display formula becomes a transparent PNG', () => {
  const image = typesetMath('\\frac{1}{\\sqrt{2}}', '#d4d4d4', 80, cell);

  const idat = [];
  for (let offset = 8; offset < image.png.length;) {
    const length = image.png.readUInt32BE(offset);
    const type = image.png.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'IDAT') idat.push(image.png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const firstScanline = inflateSync(Buffer.concat(idat));
  assert.deepEqual({
    signature: image.png.subarray(1, 4).toString('ascii'),
    colorType: image.png[25],
    topLeftAlpha: firstScanline[4],
    hasSvg: /<svg/u.test(image.svg)
  }, {
    signature: 'PNG',
    colorType: 6,
    topLeftAlpha: 0,
    hasSvg: true
  });
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
