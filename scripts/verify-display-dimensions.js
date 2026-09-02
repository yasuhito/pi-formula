#!/usr/bin/env node

const fs = require("node:fs");
const { hasPngSignature } = require("./png-signature");

function pngSize(png) {
  if (!hasPngSignature(png) || png.length < 24) {
    throw new Error("キャプチャが PNG ではありません");
  }
  if (png.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("キャプチャに IHDR がありません");
  }
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

function verifyPngDimensions(png, width, height) {
  const actual = pngSize(png);
  if (actual !== `${width}x${height}`) {
    throw new Error(
      `キャプチャが ${width}x${height} ではありません: ${actual}`,
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
  if (mode === "size") {
    console.log(pngSize(fs.readFileSync(target)));
    return;
  }
  if (mode === "png") {
    verifyPngDimensions(
      fs.readFileSync(target),
      positiveInteger(widthValue, "width"),
      positiveInteger(heightValue, "height"),
    );
    return;
  }
  throw new Error(
    "Usage: verify-display-dimensions.js <size|png> <target> [width height]",
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

module.exports = { pngSize, verifyPngDimensions };
