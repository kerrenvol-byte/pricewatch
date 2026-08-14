// מייצר את אייקוני ה-PWA (טבעת + נקודה על רקע ורוד) כ-PNG טהור, בלי תלות חיצונית.
// הרצה: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buf) {
  const table =
    crc32.table ||
    (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
      }
      return t;
    })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idatData = deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function generateIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 512;
  const rOuter = 180 * scale;
  const rInner = 140 * scale;
  const dotR = 40 * scale;
  const angle = (-50 * Math.PI) / 180;
  const dotCx = cx + 160 * scale * Math.cos(angle);
  const dotCy = cy + 160 * scale * Math.sin(angle);

  const colorA = hexToRgb('#ffc2d9');
  const colorB = hexToRgb('#d6336c');

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size);
      const bg = [lerp(colorA[0], colorB[0], t), lerp(colorA[1], colorB[1], t), lerp(colorA[2], colorB[2], t)];

      const d = Math.hypot(x - cx, y - cy);
      const outerCov = 1 - smoothstep(rOuter - scale, rOuter + scale, d);
      const innerCov = smoothstep(rInner - scale, rInner + scale, d);
      const ringCov = outerCov * innerCov;

      const dd = Math.hypot(x - dotCx, y - dotCy);
      const dotCov = 1 - smoothstep(dotR - scale, dotR + scale, dd);

      const whiteCov = Math.min(1, Math.max(ringCov, dotCov));
      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(lerp(bg[0], 255, whiteCov));
      rgba[idx + 1] = Math.round(lerp(bg[1], 255, whiteCov));
      rgba[idx + 2] = Math.round(lerp(bg[2], 255, whiteCov));
      rgba[idx + 3] = 255;
    }
  }
  return encodePNG(size, size, rgba);
}

for (const size of [180, 192, 512]) {
  writeFileSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url), generateIcon(size));
  console.log('generated icon-' + size + '.png');
}
