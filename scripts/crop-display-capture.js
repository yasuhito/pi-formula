#!/usr/bin/env node

const fs = require("node:fs");
const { deflateSync } = require("node:zlib");
const { decodePng } = require("./detect-display-bands");

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit += 1)
    value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer)
    value = (value >>> 8) ^ CRC_TABLE[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(width, height, channels, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = channels === 4 ? 6 : 2;
  const stride = width * channels;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    pixels.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function cropDisplayCapture(png, rectangle) {
  const image = decodePng(png);
  const { x, y, width, height } = rectangle;
  if (
    ![x, y, width, height].every(Number.isInteger) ||
    x < 0 ||
    y < 0 ||
    width < 1 ||
    height < 1 ||
    x + width > image.width ||
    y + height > image.height
  ) {
    throw new Error("検証ウィンドウ矩形が headless 出力の外にあります");
  }
  const stride = width * image.channels;
  const cropped = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row += 1) {
    const start = ((y + row) * image.width + x) * image.channels;
    image.pixels.copy(cropped, row * stride, start, start + stride);
  }
  return encodePng(width, height, image.channels, cropped);
}

function main() {
  try {
    const [source, target, ...values] = process.argv.slice(2);
    const [x, y, width, height] = values.map(Number);
    if (!source || !target || values.length !== 4)
      throw new Error(
        "Usage: crop-display-capture.js <source.png> <target.png> <x> <y> <width> <height>",
      );
    const cropped = cropDisplayCapture(fs.readFileSync(source), {
      x,
      y,
      width,
      height,
    });
    fs.writeFileSync(target, cropped);
  } catch (error) {
    console.error(`キャプチャ切り出し失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { cropDisplayCapture };
