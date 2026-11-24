import { decode, encode } from "jpeg-js";
import { PNG } from "pngjs";

const LONG_EDGE = 1568;
const BYTE_LIMIT = 3.5 * 1024 * 1024;

function fit(width: number, height: number): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= LONG_EDGE) return { width, height };
  const scale = LONG_EDGE / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function scaleRgba(data: Uint8Array, width: number, height: number, nextWidth: number, nextHeight: number): Uint8Array {
  const out = new Uint8Array(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor((y * height) / nextHeight));
    for (let x = 0; x < nextWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x * width) / nextWidth));
      const from = (sourceY * width + sourceX) * 4;
      const to = (y * nextWidth + x) * 4;
      out[to] = data[from] ?? 0;
      out[to + 1] = data[from + 1] ?? 0;
      out[to + 2] = data[from + 2] ?? 0;
      out[to + 3] = data[from + 3] ?? 255;
    }
  }
  return out;
}

function jpegBytes(data: Uint8Array, width: number, height: number): Buffer {
  let quality = 82;
  let bytes = Buffer.from(encode({ data, width, height }, quality).data);
  while (bytes.length > BYTE_LIMIT && quality > 40) {
    quality -= 10;
    bytes = Buffer.from(encode({ data, width, height }, quality).data);
  }
  return bytes;
}

/** JPEG with a long edge of at most 1568 px, under 3.5 MB. */
export function reviewJpeg(bytes: Buffer): Buffer {
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  const decoded = png ? PNG.sync.read(bytes) : decode(bytes, { useTArray: true, formatAsRGBA: true });
  const size = fit(decoded.width, decoded.height);
  const data = size.width === decoded.width && size.height === decoded.height
    ? decoded.data
    : scaleRgba(decoded.data, decoded.width, decoded.height, size.width, size.height);
  return jpegBytes(data, size.width, size.height);
}
