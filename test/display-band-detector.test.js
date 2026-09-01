const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const { createPng } = require('./support/png-fixture');

const detector = path.resolve(__dirname, '../scripts/detect-display-bands.js');

function runDetector(pixel) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-formula-band-'));
  const png = path.join(directory, 'capture.png');
  fs.writeFileSync(png, createPng(120, 80, pixel));
  const result = spawnSync(process.execPath, [detector, png], { encoding: 'utf8' });
  fs.rmSync(directory, { recursive: true, force: true });
  return result;
}

function normalDisplay(x, y) {
  if (y === 10 && x >= 10 && x < 90 && x % 4 === 0) return [40, 40, 35];
  if (y >= 35 && y <= 45 && x >= 25 && x < 95 && (x + y) % 11 < 2) return [40, 40, 35];
  return [250, 248, 240];
}

test('帯のない表示数式キャプチャを正常と判定する', () => {
  const result = runDetector(normalDisplay);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /異常な水平帯はありません/u);
});

test('本文色でも背景色でもない単色の水平帯を座標付きで検出する', () => {
  const result = runDetector((x, y) => {
    if (y >= 36 && y <= 43 && x >= 18 && x <= 105) return [210, 0, 170];
    return normalDisplay(x, y);
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /x=18\.\.105, y=36\.\.43/u);
});
