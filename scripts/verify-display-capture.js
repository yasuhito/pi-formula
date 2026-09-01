#!/usr/bin/env node

const fs = require("node:fs");
const { decodePng, parseColor } = require("./detect-display-bands");

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

function verifyDisplayCapture(png, { background, imageRows }) {
  const image = decodePng(png);
  const minimumInkPerRow = Math.max(8, Math.ceil(image.width * 0.05));
  const minimumImageHeight = Math.max(8, Math.min(32, imageRows * 4));
  let backgroundPixels = 0;
  let consecutiveInkRows = 0;
  let maximumInkRows = 0;

  for (let y = 0; y < image.height; y += 1) {
    let ink = 0;
    let inkTransitions = 0;
    let previousIsInk = false;
    const rowOffset = y * image.width * image.channels;
    for (let x = 0; x < image.width; x += 1) {
      const offset = rowOffset + x * image.channels;
      const distance = distanceFrom(
        background,
        image.pixels[offset],
        image.pixels[offset + 1],
        image.pixels[offset + 2],
      );
      const isInk = distance > 16;
      if (isInk) ink += 1;
      else backgroundPixels += 1;
      if (x > 0 && isInk !== previousIsInk) inkTransitions += 1;
      previousIsInk = isInk;
    }
    const hasImageInk = ink >= minimumInkPerRow && inkTransitions >= 10;
    consecutiveInkRows = hasImageInk ? consecutiveInkRows + 1 : 0;
    maximumInkRows = Math.max(maximumInkRows, consecutiveInkRows);
  }

  const backgroundRatio = backgroundPixels / (image.width * image.height);
  if (backgroundRatio < 0.01) {
    throw new Error("検証ウィンドウ以外の背景がキャプチャに含まれています");
  }
  if (maximumInkRows < minimumImageHeight) {
    throw new Error("表示数式の画像行がキャプチャにありません");
  }
}

function parseArguments(args) {
  let background;
  let imageRows;
  let filename;
  for (const argument of args) {
    if (argument.startsWith("--background="))
      background = parseColor(argument.slice(13));
    else if (argument.startsWith("--image-rows="))
      imageRows = Number(argument.slice(13));
    else if (!filename) filename = argument;
    else throw new Error(`不明な引数です: ${argument}`);
  }
  if (
    background === undefined ||
    !Number.isInteger(imageRows) ||
    imageRows < 1 ||
    !filename
  ) {
    throw new Error(
      "Usage: verify-display-capture.js --background=R,G,B --image-rows=N <capture.png>",
    );
  }
  return { background, imageRows, filename };
}

function main() {
  try {
    const { filename, ...options } = parseArguments(process.argv.slice(2));
    verifyDisplayCapture(fs.readFileSync(filename), options);
    console.log("表示数式の画像行をキャプチャで確認しました");
  } catch (error) {
    console.error(`キャプチャ検証失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { verifyDisplayCapture };
