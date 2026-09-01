const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { createPng, createPngFromScanlines } = require("./support/png-fixture");

const detector = path.resolve(__dirname, "../scripts/detect-display-bands.js");
const detectorArgs = [
  "--background=250,248,240",
  "--body=40,40,35",
  "--ignore=230,228,217",
  "--ignore=140,100,30",
];

function runPng(png, timeout = 5_000) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pi-formula-band-"));
  const filename = path.join(directory, "capture.png");
  fs.writeFileSync(filename, png);
  const result = spawnSync(
    process.execPath,
    [detector, ...detectorArgs, filename],
    {
      encoding: "utf8",
      timeout,
    },
  );
  fs.rmSync(directory, { recursive: true, force: true });
  return result;
}

function normalDisplay(x, y) {
  if (y >= 8 && y <= 13 && x >= 8 && x <= 111) return [230, 228, 217]; // 非数式 UI
  if (y >= 18 && y <= 22 && x >= 10 && x <= 100) return [140, 100, 31]; // UI 色の量子化誤差
  if (y === 28 && x >= 18 && x <= 101) return [40, 40, 35]; // 長い分数線
  if (y >= 35 && y <= 45 && x >= 25 && x < 95 && (x + y) % 11 < 2)
    return [40, 40, 35];
  if (y === 60 && x >= 8 && x <= 111 && x % 3 !== 0) return [40, 40, 35]; // コード・URL 相当
  if (y >= 65 && y <= 70 && x >= 20 && x <= 85) return [40, 40, 36]; // 本文の量子化誤差
  return [250, 248, 240];
}

test("本文色の長い分数線と非数式 UI を正常と判定する", () => {
  const result = runPng(createPng(120, 80, normalDisplay));

  assert.deepEqual(
    {
      status: result.status,
      reportsNoBands: /異常な水平帯はありません/u.test(result.stdout),
    },
    { status: 0, reportsNoBands: true },
  );
});

test("ID 色の水平帯を座標付きで検出する", () => {
  const result = runPng(
    createPng(120, 80, (x, y) => {
      if (y >= 36 && y <= 43 && x >= 18 && x <= 105) return [210, 0, 170];
      return normalDisplay(x, y);
    }),
  );

  assert.deepEqual(
    {
      status: result.status,
      reportsCoordinates: /x=18\.\.105, y=36\.\.43/u.test(result.stdout),
    },
    { status: 1, reportsCoordinates: true },
  );
});

test("本文色とは異なる黒帯を検出する", () => {
  const result = runPng(
    createPng(120, 80, (x, y) => {
      if (y >= 36 && y <= 43 && x >= 18 && x <= 105) return [0, 0, 0];
      return normalDisplay(x, y);
    }),
  );

  assert.deepEqual(
    {
      status: result.status,
      reportsBlack: /rgb=0,0,0/u.test(result.stdout),
    },
    { status: 1, reportsBlack: true },
  );
});

test("1920px 画面上の短い表示数式帯を検出する", () => {
  const result = runPng(
    createPng(1920, 80, (x, y) => {
      if (y >= 36 && y <= 43 && x >= 100 && x <= 299) return [210, 0, 170];
      return normalDisplay(x, y);
    }),
  );

  assert.deepEqual(
    {
      status: result.status,
      reportsCoordinates: /x=100\.\.299, y=36\.\.43/u.test(result.stdout),
    },
    { status: 1, reportsCoordinates: true },
  );
});

test("本文色の字形で細かく分断された表示数式帯を検出する", () => {
  const result = runPng(
    createPng(1920, 80, (x, y) => {
      const inBand = y >= 36 && y <= 43 && x >= 100 && x <= 299;
      if (inBand && (x - 100) % 10 < 8) return [210, 0, 170];
      if (inBand) return [40, 40, 35];
      return normalDisplay(x, y);
    }),
  );

  assert.deepEqual(
    {
      status: result.status,
      reportsCoordinates: /x=100\.\.297, y=36\.\.43/u.test(result.stdout),
    },
    { status: 1, reportsCoordinates: true },
  );
});

test("途中で切れた scanline を破損 PNG として拒否する", () => {
  const expected = (120 * 4 + 1) * 80;
  const result = runPng(
    createPngFromScanlines(120, 80, Buffer.alloc(expected - 10)),
  );

  assert.deepEqual(
    {
      status: result.status,
      reportsLength: /展開長/u.test(result.stderr),
    },
    { status: 2, reportsLength: true },
  );
});

test("行が欠けた PNG を破損 PNG として拒否する", () => {
  const result = runPng(
    createPngFromScanlines(120, 80, Buffer.alloc((120 * 4 + 1) * 79)),
  );

  assert.deepEqual(
    {
      status: result.status,
      reportsLength: /展開長/u.test(result.stderr),
    },
    { status: 2, reportsLength: true },
  );
});

test("宣言寸法を超えて展開する PNG を拒否する", () => {
  const result = runPng(
    createPngFromScanlines(1, 1, Buffer.alloc(1024 * 1024)),
  );

  assert.equal(result.status, 2);
});

test("色変化が多い最大寸法を判定器の時間上限内で判定する", {
  timeout: 40_000,
}, () => {
  const width = 1920;
  const height = 16000;
  const stride = width * 3;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 3;
      scanlines[offset] = x & 0xff;
      scanlines[offset + 1] = (x * 3) & 0xff;
      scanlines[offset + 2] = (x * 7) & 0xff;
    }
  }
  const result = runPng(
    createPngFromScanlines(width, height, scanlines, 2),
    30_000,
  );

  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
});
