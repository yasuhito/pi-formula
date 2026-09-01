#!/usr/bin/env node

const fs = require("node:fs");
const { hasPngSignature } = require("./png-signature");

function monitorId(monitors, name, width, height) {
  const matches = monitors.filter(
    (monitor) =>
      monitor.name === name &&
      monitor.disabled === false &&
      monitor.width === width &&
      monitor.height === height,
  );
  if (matches.length !== 1 || !Number.isInteger(matches[0].id)) {
    throw new Error(`headless 出力が ${width}x${height} ではありません`);
  }
  return matches[0].id;
}

function verifyPngDimensions(png, width, height) {
  if (!hasPngSignature(png) || png.length < 24) {
    throw new Error("キャプチャが PNG ではありません");
  }
  if (png.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("キャプチャに IHDR がありません");
  }
  const actualWidth = png.readUInt32BE(16);
  const actualHeight = png.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height) {
    throw new Error(
      `キャプチャが ${width}x${height} ではありません: ${actualWidth}x${actualHeight}`,
    );
  }
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${name} が不正です`);
  return parsed;
}

function main(args) {
  const [mode, target, widthValue, heightValue] = args;
  const width = positiveInteger(widthValue, "width");
  const height = positiveInteger(heightValue, "height");
  if (mode === "monitor") {
    const monitors = JSON.parse(fs.readFileSync(0, "utf8"));
    console.log(monitorId(monitors, target, width, height));
    return;
  }
  if (mode === "png") {
    verifyPngDimensions(fs.readFileSync(target), width, height);
    return;
  }
  throw new Error(
    "Usage: verify-display-dimensions.js <monitor|png> <target> <width> <height>",
  );
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`寸法確認失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = { monitorId, verifyPngDimensions };
