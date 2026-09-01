#!/usr/bin/env node

const fs = require("node:fs");
const { inflateSync } = require("node:zlib");

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const MAX_PIXELS = 1920 * 16000;

function readChunks(png) {
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE))
    throw new Error("PNG signature がありません");
  const chunks = [];
  for (let offset = 8; offset < png.length; ) {
    if (offset + 12 > png.length)
      throw new Error("PNG chunk が途中で切れています");
    const length = png.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > png.length) throw new Error("PNG chunk が途中で切れています");
    chunks.push({
      type: png.subarray(offset + 4, offset + 8).toString("ascii"),
      data: png.subarray(offset + 8, offset + 8 + length),
    });
    offset = end;
  }
  return chunks;
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance)
    return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodePng(png) {
  const chunks = readChunks(png);
  const header = chunks.find(({ type }) => type === "IHDR")?.data;
  if (header?.length !== 13) throw new Error("PNG に正しい IHDR がありません");
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : undefined;
  if (
    bitDepth !== 8 ||
    channels === undefined ||
    header[10] !== 0 ||
    header[11] !== 0 ||
    header[12] !== 0
  ) {
    throw new Error(
      "標準圧縮・filter の 8-bit RGB/RGBA 非インターレース PNG だけを判定できます",
    );
  }
  if (width === 0 || height === 0 || width * height > MAX_PIXELS) {
    throw new Error(`PNG の画素数が上限 ${MAX_PIXELS} を超えています`);
  }

  const stride = width * channels;
  const expectedLength = (stride + 1) * height;
  const packed = inflateSync(
    Buffer.concat(
      chunks.filter(({ type }) => type === "IDAT").map(({ data }) => data),
    ),
    { maxOutputLength: expectedLength },
  );
  if (packed.length !== expectedLength) {
    throw new Error(
      `PNG の展開長が不正です: expected ${expectedLength}, got ${packed.length}`,
    );
  }

  const pixels = Buffer.allocUnsafe(stride * height);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = packed[inputOffset];
    inputOffset += 1;
    if (filter > 4) throw new Error(`未対応の PNG filter: ${filter}`);
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[inputOffset + x];
      const left = x >= channels ? pixels[rowOffset + x - channels] : 0;
      const above = y > 0 ? pixels[rowOffset + x - stride] : 0;
      const upperLeft =
        y > 0 && x >= channels ? pixels[rowOffset + x - stride - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = (left + above) >>> 1;
      else if (filter === 4) predictor = paeth(left, above, upperLeft);
      pixels[rowOffset + x] = (raw + predictor) & 0xff;
    }
    inputOffset += stride;
  }
  return { width, height, channels, pixels };
}

function packedColor(red, green, blue) {
  return (red << 16) | (green << 8) | blue;
}

function colorAt(pixels, offset) {
  return packedColor(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
}

function colorText(color) {
  return `${(color >>> 16) & 0xff},${(color >>> 8) & 0xff},${color & 0xff}`;
}

function parseColor(value) {
  const channels = value.split(",").map(Number);
  if (
    channels.length !== 3 ||
    channels.some(
      (channel) => !Number.isInteger(channel) || channel < 0 || channel > 255,
    )
  )
    throw new Error(`RGB が不正です: ${value}`);
  return packedColor(...channels);
}

function dominantColor(image) {
  const counts = new Uint32Array(1 << 24);
  let dominant = 0;
  let maximum = 0;
  for (let offset = 0; offset < image.pixels.length; offset += image.channels) {
    const color = colorAt(image.pixels, offset);
    const count = ++counts[color];
    if (count > maximum) {
      maximum = count;
      dominant = color;
    }
  }
  return dominant;
}

function colorDistance(left, right) {
  const red = ((left >>> 16) & 0xff) - ((right >>> 16) & 0xff);
  const green = ((left >>> 8) & 0xff) - ((right >>> 8) & 0xff);
  const blue = (left & 0xff) - (right & 0xff);
  return Math.sqrt(red * red + green * green + blue * blue);
}

function isPaletteColor(color, palette) {
  for (const paletteColor of palette) {
    if (colorDistance(color, paletteColor) <= 2) return true;
  }
  return false;
}

function horizontalRuns(image, background, ignored) {
  const minimumComponentWidth = 2;
  const minimumBandWidth = 48;
  const maximumGlyphGap = 16;
  const minimumCoverage = 0.4;
  const runs = [];
  const { pixels, channels, width, height } = image;
  for (let y = 0; y < height; y += 1) {
    const candidates = new Map();
    const finish = (candidate) => {
      if (!candidate) return;
      const span = candidate.x2 - candidate.x1 + 1;
      if (
        span >= minimumBandWidth &&
        candidate.covered >= Math.max(8, Math.ceil(span * minimumCoverage))
      ) {
        runs.push({
          color: candidate.color,
          x1: candidate.x1,
          x2: candidate.x2,
          y1: y,
          y2: y,
          rows: 1,
        });
      }
    };
    const rowOffset = y * width * channels;
    let start = 0;
    let color = colorAt(pixels, rowOffset);
    for (let x = 1; x <= width; x += 1) {
      const next = x < width ? colorAt(pixels, rowOffset + x * channels) : -1;
      if (next === color) continue;
      const runWidth = x - start;
      if (
        runWidth >= minimumComponentWidth &&
        !isPaletteColor(color, ignored) &&
        colorDistance(color, background) > 32
      ) {
        const previous = candidates.get(color);
        if (previous && start - previous.x2 - 1 <= maximumGlyphGap) {
          previous.x2 = x - 1;
          previous.covered += runWidth;
        } else {
          finish(previous);
          candidates.set(color, {
            color,
            x1: start,
            x2: x - 1,
            covered: runWidth,
          });
        }
      }
      start = x;
      color = next;
    }
    for (const candidate of candidates.values()) finish(candidate);
  }
  return runs;
}

function mergeRuns(runs) {
  const bands = [];
  for (const run of runs) {
    const previous = [...bands]
      .reverse()
      .find(
        (band) =>
          band.color === run.color &&
          run.y1 - band.y2 === 1 &&
          run.x1 <= band.x2 &&
          run.x2 >= band.x1,
      );
    if (previous) {
      previous.x1 = Math.min(previous.x1, run.x1);
      previous.x2 = Math.max(previous.x2, run.x2);
      previous.y2 = run.y2;
      previous.rows += 1;
    } else bands.push({ ...run });
  }
  const substantial = bands
    .filter(({ rows }) => rows >= 3)
    .sort((left, right) => left.color - right.color || left.y1 - right.y1);
  const coalesced = [];
  for (const band of substantial) {
    const previous = coalesced.at(-1);
    if (
      previous &&
      previous.color === band.color &&
      band.y1 <= previous.y2 + 1 &&
      band.x1 <= previous.x2 &&
      band.x2 >= previous.x1
    ) {
      previous.x1 = Math.min(previous.x1, band.x1);
      previous.x2 = Math.max(previous.x2, band.x2);
      previous.y2 = Math.max(previous.y2, band.y2);
      previous.rows += band.rows;
    } else coalesced.push({ ...band });
  }
  return coalesced.sort((left, right) => left.y1 - right.y1);
}

function detectDisplayBands(png, options = {}) {
  const image = decodePng(png);
  const background = options.background ?? dominantColor(image);
  const ignored = new Set(options.ignored ?? []);
  ignored.add(background);
  if (options.body !== undefined) ignored.add(options.body);
  const top = image.height * 0.01;
  const bottom = image.height * 0.99;
  return mergeRuns(horizontalRuns(image, background, ignored)).filter(
    ({ y1, y2 }) => y2 >= top && y1 <= bottom,
  );
}

function parseArguments(args) {
  const options = { ignored: [] };
  let filename;
  for (const argument of args) {
    if (argument.startsWith("--background="))
      options.background = parseColor(argument.slice(13));
    else if (argument.startsWith("--body="))
      options.body = parseColor(argument.slice(7));
    else if (argument.startsWith("--ignore="))
      options.ignored.push(parseColor(argument.slice(9)));
    else if (!filename) filename = argument;
    else throw new Error(`不明な引数です: ${argument}`);
  }
  if (!filename)
    throw new Error(
      "Usage: detect-display-bands.js [--background=R,G,B] [--body=R,G,B] [--ignore=R,G,B] <capture.png>",
    );
  return { filename, options };
}

function main() {
  try {
    const { filename, options } = parseArguments(process.argv.slice(2));
    const bands = detectDisplayBands(fs.readFileSync(filename), options);
    if (bands.length === 0) {
      console.log("異常な水平帯はありません");
      return;
    }
    console.log(`異常な水平帯を ${bands.length} 件検出しました`);
    for (const band of bands) {
      console.log(
        `- x=${band.x1}..${band.x2}, y=${band.y1}..${band.y2}, rgb=${colorText(band.color)}`,
      );
    }
    process.exitCode = 1;
  } catch (error) {
    console.error(`判定失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { decodePng, detectDisplayBands, parseColor };
