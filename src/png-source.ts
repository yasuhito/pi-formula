import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { crc32, inflateSync } from "node:zlib";

import { FORMULA_SAFETY_LIMITS } from "./typesetter";

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const;

export type PngSource = Buffer | string;

export type PngLoadResult =
  | { loaded: true; data: Buffer; width: number; height: number }
  | { loaded: false; reason: "invalid-png" | "safety-limit" };

interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlace: number;
}

interface ScanlinePass {
  rows: number;
  bytesPerRow: number;
}

function failed(reason: "invalid-png" | "safety-limit"): PngLoadResult {
  return { loaded: false, reason };
}

function readRegularFile(path: string): PngLoadResult | Buffer {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      path,
      constants.O_RDONLY | (constants.O_NONBLOCK ?? 0),
    );
    const stats = fstatSync(descriptor);
    if (!stats.isFile()) return failed("invalid-png");
    if (stats.size > FORMULA_SAFETY_LIMITS.pngBytes) {
      return failed("safety-limit");
    }
    const buffer = Buffer.allocUnsafe(stats.size + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      const count = readSync(
        descriptor,
        buffer,
        bytesRead,
        buffer.length - bytesRead,
        null,
      );
      if (count === 0) break;
      bytesRead += count;
    }
    if (bytesRead > FORMULA_SAFETY_LIMITS.pngBytes) {
      return failed("safety-limit");
    }
    return buffer.subarray(0, bytesRead);
  } catch {
    return failed("invalid-png");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function sourceBuffer(source: PngSource): PngLoadResult | Buffer {
  if (Buffer.isBuffer(source)) {
    if (source.length > FORMULA_SAFETY_LIMITS.pngBytes) {
      return failed("safety-limit");
    }
    return Buffer.from(source);
  }
  if (typeof source !== "string" || source.length === 0) {
    return failed("invalid-png");
  }
  return readRegularFile(source);
}

function parseHeader(data: Buffer): PngHeader | undefined {
  if (data.length !== 13) return undefined;
  const width = data.readUInt32BE(0);
  const height = data.readUInt32BE(4);
  const bitDepth = data[8] as number;
  const colorType = data[9] as number;
  const validDepths: Record<number, readonly number[]> = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  };
  if (
    width === 0 ||
    height === 0 ||
    !validDepths[colorType]?.includes(bitDepth) ||
    data[10] !== 0 ||
    data[11] !== 0 ||
    (data[12] !== 0 && data[12] !== 1)
  ) {
    return undefined;
  }
  return { width, height, bitDepth, colorType, interlace: data[12] };
}

function passSize(length: number, start: number, step: number): number {
  return length <= start ? 0 : Math.ceil((length - start) / step);
}

function scanlinePasses(header: PngHeader): ScanlinePass[] {
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.colorType] as number;
  const bitsPerPixel = channels * header.bitDepth;
  const patterns = header.interlace === 0 ? ([[0, 0, 1, 1]] as const) : ADAM7;
  const passes: ScanlinePass[] = [];
  for (const [startX, startY, stepX, stepY] of patterns) {
    const width = passSize(header.width, startX, stepX);
    const rows = passSize(header.height, startY, stepY);
    if (width === 0 || rows === 0) continue;
    passes.push({ rows, bytesPerRow: Math.ceil((width * bitsPerPixel) / 8) });
  }
  return passes;
}

function decodedScanlines(
  compressed: Buffer,
  passes: readonly ScanlinePass[],
): Buffer | undefined {
  const expected = passes.reduce(
    (total, pass) => total + pass.rows * (pass.bytesPerRow + 1),
    0,
  );
  try {
    const result = inflateSync(compressed, {
      info: true,
      maxOutputLength: expected + 1,
    }) as unknown as { buffer: Buffer; engine: { bytesWritten: number } };
    const decoded = result.buffer;
    if (
      decoded.length !== expected ||
      result.engine.bytesWritten !== compressed.length
    ) {
      return undefined;
    }
    let offset = 0;
    for (const pass of passes) {
      for (let row = 0; row < pass.rows; row += 1) {
        if ((decoded[offset] as number) > 4) return undefined;
        offset += pass.bytesPerRow + 1;
      }
    }
    return decoded;
  } catch {
    return undefined;
  }
}

function validChunkCrc(type: Buffer, data: Buffer, expected: number): boolean {
  return crc32(data, crc32(type)) === expected;
}

interface PngChunk {
  name: string;
  type: Buffer;
  data: Buffer;
  end: number;
}

interface PngParserState {
  header?: PngHeader;
  paletteEntries?: number;
  sawIdat: boolean;
  endedIdat: boolean;
  imageData: Buffer[];
}

function readChunk(png: Buffer, offset: number): PngChunk | undefined {
  if (png.length - offset < 12) return undefined;
  const length = png.readUInt32BE(offset);
  const end = offset + 12 + length;
  if (end > png.length) return undefined;
  const type = png.subarray(offset + 4, offset + 8);
  const name = type.toString("ascii");
  const data = png.subarray(offset + 8, offset + 8 + length);
  if (
    !/^[A-Za-z]{4}$/u.test(name) ||
    (type[2] as number) < 65 ||
    (type[2] as number) > 90 ||
    !validChunkCrc(type, data, png.readUInt32BE(offset + 8 + length))
  ) {
    return undefined;
  }
  return { name, type, data, end };
}

function initialHeader(chunk: PngChunk): PngHeader | PngLoadResult {
  if (chunk.name !== "IHDR") return failed("invalid-png");
  const header = parseHeader(chunk.data);
  if (!header) return failed("invalid-png");
  if (
    header.width > Math.floor(FORMULA_SAFETY_LIMITS.pngPixels / header.height)
  ) {
    return failed("safety-limit");
  }
  return header;
}

function acceptPalette(state: PngParserState, chunk: PngChunk): boolean {
  const length = chunk.data.length;
  if (
    state.sawIdat ||
    state.paletteEntries !== undefined ||
    length === 0 ||
    length > 768 ||
    length % 3 !== 0
  ) {
    return false;
  }
  state.paletteEntries = length / 3;
  return true;
}

function validPalette(state: PngParserState): boolean {
  const header = state.header as PngHeader;
  if (header.colorType === 3) {
    return (
      state.paletteEntries !== undefined &&
      state.paletteEntries <= 2 ** header.bitDepth
    );
  }
  return !(
    (header.colorType === 0 || header.colorType === 4) &&
    state.paletteEntries !== undefined
  );
}

function finishPng(
  png: Buffer,
  state: PngParserState,
  chunk: PngChunk,
): PngLoadResult {
  const header = state.header as PngHeader;
  if (
    !state.sawIdat ||
    chunk.data.length !== 0 ||
    chunk.end !== png.length ||
    !validPalette(state) ||
    !decodedScanlines(Buffer.concat(state.imageData), scanlinePasses(header))
  ) {
    return failed("invalid-png");
  }
  return {
    loaded: true,
    data: png,
    width: header.width,
    height: header.height,
  };
}

function acceptOtherChunk(state: PngParserState, chunk: PngChunk): boolean {
  if (state.sawIdat) state.endedIdat = true;
  const first = chunk.type[0] as number;
  return first < 65 || first > 90;
}

export function loadPng(source: PngSource): PngLoadResult {
  const loaded = sourceBuffer(source);
  if (!Buffer.isBuffer(loaded)) return loaded;
  const png = loaded;
  if (
    png.length < 57 ||
    !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    return failed("invalid-png");
  }

  const state: PngParserState = {
    sawIdat: false,
    endedIdat: false,
    imageData: [],
  };
  let offset = PNG_SIGNATURE.length;
  while (offset < png.length) {
    const chunk = readChunk(png, offset);
    if (!chunk) return failed("invalid-png");
    if (!state.header) {
      const header = initialHeader(chunk);
      if ("loaded" in header) return header;
      state.header = header;
    } else if (chunk.name === "IHDR") {
      return failed("invalid-png");
    } else if (chunk.name === "PLTE") {
      if (!acceptPalette(state, chunk)) return failed("invalid-png");
    } else if (chunk.name === "IDAT") {
      if (state.endedIdat) return failed("invalid-png");
      state.sawIdat = true;
      state.imageData.push(chunk.data);
    } else if (chunk.name === "IEND") {
      return finishPng(png, state, chunk);
    } else if (!acceptOtherChunk(state, chunk)) {
      return failed("invalid-png");
    }
    offset = chunk.end;
  }
  return failed("invalid-png");
}
