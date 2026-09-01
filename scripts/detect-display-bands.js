#!/usr/bin/env node

const fs = require('node:fs');
const { inflateSync } = require('node:zlib');

function readChunks(png) {
  if (!png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new Error('PNG signature がありません');
  }
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    chunks.push({ type, data: png.subarray(offset + 8, offset + 8 + length) });
    offset += length + 12;
  }
  return chunks;
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodePng(png) {
  const chunks = readChunks(png);
  const header = chunks.find(({ type }) => type === 'IHDR')?.data;
  if (!header) throw new Error('PNG に IHDR がありません');
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : undefined;
  if (bitDepth !== 8 || channels === undefined || header[12] !== 0) {
    throw new Error('8-bit RGB/RGBA の非インターレース PNG だけを判定できます');
  }

  const packed = inflateSync(Buffer.concat(
    chunks.filter(({ type }) => type === 'IDAT').map(({ data }) => data)
  ));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = packed[inputOffset];
    inputOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[inputOffset + x];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const above = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= channels
        ? pixels[(y - 1) * stride + x - channels]
        : 0;
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth(left, above, upperLeft)][filter];
      if (predictor === undefined) throw new Error(`未対応の PNG filter: ${filter}`);
      pixels[y * stride + x] = (raw + predictor) & 0xff;
    }
    inputOffset += stride;
  }
  return { width, height, channels, pixels };
}

function rgbAt(image, x, y) {
  const offset = (y * image.width + x) * image.channels;
  return `${image.pixels[offset]},${image.pixels[offset + 1]},${image.pixels[offset + 2]}`;
}

function dominantColor(image) {
  const counts = new Map();
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const color = rgbAt(image, x, y);
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }
  return [...counts].sort((left, right) => right[1] - left[1])[0][0];
}

function colorDistance(left, right) {
  const leftChannels = left.split(',').map(Number);
  const rightChannels = right.split(',').map(Number);
  return Math.hypot(...leftChannels.map((channel, index) => channel - rightChannels[index]));
}

function horizontalRuns(image, background) {
  const minimumWidth = Math.max(12, Math.ceil(image.width * 0.2));
  const runs = [];
  for (let y = 0; y < image.height; y += 1) {
    let start = 0;
    let color = rgbAt(image, 0, y);
    for (let x = 1; x <= image.width; x += 1) {
      const next = x < image.width ? rgbAt(image, x, y) : undefined;
      if (next === color) continue;
      if (colorDistance(color, background) > 32 && x - start >= minimumWidth) {
        runs.push({ color, x1: start, x2: x - 1, y1: y, y2: y, rows: 1 });
      }
      start = x;
      color = next;
    }
  }
  return runs;
}

function mergeRuns(runs) {
  const bands = [];
  for (const run of runs) {
    const previous = [...bands].reverse().find((band) =>
      band.color === run.color
      && run.y1 - band.y2 <= 24
      && run.x1 <= band.x2
      && run.x2 >= band.x1
    );
    if (previous) {
      previous.x1 = Math.min(previous.x1, run.x1);
      previous.x2 = Math.max(previous.x2, run.x2);
      previous.y2 = run.y2;
      previous.rows += 1;
    } else {
      bands.push({ ...run });
    }
  }
  const substantial = bands
    .filter(({ rows }) => rows >= 3)
    .sort((left, right) => left.color.localeCompare(right.color) || left.y1 - right.y1);
  const coalesced = [];
  for (const band of substantial) {
    const previous = coalesced.at(-1);
    if (previous && previous.color === band.color && band.y1 - previous.y2 <= 24
      && band.x1 <= previous.x2 && band.x2 >= previous.x1) {
      previous.x1 = Math.min(previous.x1, band.x1);
      previous.x2 = Math.max(previous.x2, band.x2);
      previous.y2 = Math.max(previous.y2, band.y2);
      previous.rows += band.rows;
    } else {
      coalesced.push({ ...band });
    }
  }
  return coalesced.sort((left, right) => left.y1 - right.y1);
}

function detectDisplayBands(png) {
  const image = decodePng(png);
  const top = image.height * 0.01;
  const bottom = image.height * 0.99;
  return mergeRuns(horizontalRuns(image, dominantColor(image)))
    .filter(({ y1, y2 }) => y2 >= top && y1 <= bottom);
}

function main() {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Usage: detect-display-bands.js <capture.png>');
    process.exitCode = 2;
    return;
  }
  try {
    const bands = detectDisplayBands(fs.readFileSync(filename));
    if (bands.length === 0) {
      console.log('異常な水平帯はありません');
      return;
    }
    console.log(`異常な水平帯を ${bands.length} 件検出しました`);
    for (const band of bands) {
      console.log(`- x=${band.x1}..${band.x2}, y=${band.y1}..${band.y2}, rgb=${band.color}`);
    }
    process.exitCode = 1;
  } catch (error) {
    console.error(`判定失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { decodePng, detectDisplayBands };
