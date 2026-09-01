#!/usr/bin/env node

const fs = require("node:fs");
const { decodePng, parseColor } = require("./detect-display-bands");

// 端末ウィンドウが写っていれば背景がこの割合以上を占める。
const MINIMUM_BACKGROUND_RATIO = 0.01;
// 何かが描かれていれば背景以外がこの割合以上を占める。
const MINIMUM_INK_RATIO = 0.001;
const BACKGROUND_DISTANCE = 16;

function distanceFrom(color, red, green, blue) {
  const expectedRed = (color >>> 16) & 0xff;
  const expectedGreen = (color >>> 8) & 0xff;
  const expectedBlue = color & 0xff;
  return Math.sqrt(
    (red - expectedRed) ** 2 +
      (green - expectedGreen) ** 2 +
      (blue - expectedBlue) ** 2,
  );
}

function measureInk(image, backgrounds) {
  let backgroundPixels = 0;
  for (let offset = 0; offset < image.pixels.length; offset += image.channels) {
    const isBackground = backgrounds.some(
      (color) =>
        distanceFrom(
          color,
          image.pixels[offset],
          image.pixels[offset + 1],
          image.pixels[offset + 2],
        ) <= BACKGROUND_DISTANCE,
    );
    if (isBackground) backgroundPixels += 1;
  }
  const total = image.width * image.height;
  return {
    backgroundRatio: backgroundPixels / total,
    inkRatio: (total - backgroundPixels) / total,
  };
}

function isSameImage(image, other) {
  return (
    image.width === other.width &&
    image.height === other.height &&
    image.pixels.equals(other.pixels)
  );
}

function checkDisplayRendered(image, previous, backgrounds) {
  const { backgroundRatio, inkRatio } = measureInk(image, backgrounds);
  if (backgroundRatio < MINIMUM_BACKGROUND_RATIO) {
    throw new Error("検証ウィンドウの背景がキャプチャに写っていません");
  }
  if (inkRatio < MINIMUM_INK_RATIO) {
    throw new Error("キャプチャに描画がありません");
  }
  if (previous === undefined) {
    throw new Error("比較対象の前回キャプチャがまだありません");
  }
  if (!isSameImage(image, previous)) {
    throw new Error("キャプチャが前回から変化しています");
  }
}

function parseArguments(args) {
  const backgrounds = [];
  let previousFilename;
  let filename;
  for (const argument of args) {
    if (argument.startsWith("--background="))
      backgrounds.push(parseColor(argument.slice(13)));
    else if (argument.startsWith("--previous="))
      previousFilename = argument.slice(11);
    else if (!filename) filename = argument;
    else throw new Error(`不明な引数です: ${argument}`);
  }
  if (backgrounds.length === 0 || !filename) {
    throw new Error(
      "Usage: check-display-rendered.js --background=R,G,B [--background=R,G,B] [--previous=<capture.png>] <capture.png>",
    );
  }
  return { backgrounds, previousFilename, filename };
}

function main() {
  let image;
  let previous;
  let backgrounds;
  try {
    const parsed = parseArguments(process.argv.slice(2));
    backgrounds = parsed.backgrounds;
    image = decodePng(fs.readFileSync(parsed.filename));
    if (parsed.previousFilename !== undefined) {
      previous = decodePng(fs.readFileSync(parsed.previousFilename));
    }
  } catch (error) {
    console.error(`描画完了の検査失敗: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  try {
    checkDisplayRendered(image, previous, backgrounds);
    console.log("Ghostty の描画完了をキャプチャで確認しました");
  } catch (error) {
    console.error(`描画は未完了: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { checkDisplayRendered };
