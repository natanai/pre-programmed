// Generate deterministic, dependency-free brand PNGs and Windows favicon from one geometry.
import { writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../public/", import.meta.url));
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type, data) {
  const tag = Buffer.from(type);
  const payload = Buffer.concat([tag, data]);
  let crc = 0xffffffff;
  for (const b of payload) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  const footer = Buffer.alloc(4);
  footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, payload, footer]);
}
function png(width, height, ink) {
  const bytes = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const start = y * (1 + width * 4);
    for (let x = 0; x < width; x++) {
      const i = start + 1 + x * 4;
      const white = ink(x, y);
      bytes[i] = bytes[i + 1] = bytes[i + 2] = white ? 255 : 0;
      bytes[i + 3] = 255;
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8; head[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", head), chunk("IDAT", deflateSync(bytes, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
// Square occupies 39.06% of image width, with a slim scalable outline.
// For tiny favicons, preserve legibility with a minimum 1px line.
function squareInk(x, y, size, centerX = size / 2, centerY = size / 2) {
  const side = size * 200 / 512;
  const stroke = Math.max(1, size * 6 / 512);
  const dx = Math.abs(x + .5 - centerX), dy = Math.abs(y + .5 - centerY);
  return dx <= side / 2 + stroke / 2 && dy <= side / 2 + stroke / 2 &&
    (dx >= side / 2 - stroke / 2 || dy >= side / 2 - stroke / 2);
}
const icons = new Map();
for (const size of [16, 32, 48, 180, 192, 512]) {
  const data = png(size, size, (x, y) => squareInk(x, y, size));
  icons.set(size, data);
  if ([180, 192, 512].includes(size)) await writeFile(root + "icon-" + size + ".png", data);
}
const entries = [16, 32, 48].map(size => ({ size, data: icons.get(size) }));
const icoHeader = Buffer.alloc(6 + entries.length * 16);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(entries.length, 4);
let offset = icoHeader.length;
for (let i = 0; i < entries.length; i++) {
  const { size, data } = entries[i];
  const j = 6 + i * 16;
  icoHeader[j] = size;
  icoHeader[j + 1] = size;
  icoHeader[j + 2] = 0;
  icoHeader[j + 3] = 0;
  icoHeader.writeUInt16LE(1, j + 4);
  icoHeader.writeUInt16LE(32, j + 6);
  icoHeader.writeUInt32LE(data.length, j + 8);
  icoHeader.writeUInt32LE(offset, j + 12);
  offset += data.length;
}
await writeFile(root + "favicon.ico", Buffer.concat([icoHeader, ...entries.map(e => e.data)]));
const width = 1200, height = 630;
await writeFile(root + "social-card.png", png(width, height, (x, y) => {
  const size = 512;
  return squareInk(x - (width - size) / 2, y - (height - size) / 2, size);
}));
