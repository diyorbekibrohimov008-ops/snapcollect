import { PNG } from 'pngjs';

export type SampleDocKind =
  | 'w2_2025_crisp'
  | 'w2_2025_blurry'
  | 'w2_2024_wrong_year'
  | 'bank_2025_crisp'
  | 'gov_id_crisp';

// Compact 5x7 uppercase bitmap font for clean, legible programmatic document PNGs
const FONT_5X7: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00100', '00100'],
  ',': ['00000', '00000', '00000', '00000', '00000', '00100', '01000'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function setPixel(buf: Buffer, width: number, height: number, x: number, y: number, r: number, g: number, b: number) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const idx = (y * width + x) * 4;
  buf[idx] = r;
  buf[idx + 1] = g;
  buf[idx + 2] = b;
  buf[idx + 3] = 255;
}

function drawRect(
  buf: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  thickness = 2,
) {
  for (let t = 0; t < thickness; t++) {
    for (let px = x; px < x + w; px++) {
      setPixel(buf, width, height, px, y + t, r, g, b);
      setPixel(buf, width, height, px, y + h - 1 - t, r, g, b);
    }
    for (let py = y; py < y + h; py++) {
      setPixel(buf, width, height, x + t, py, r, g, b);
      setPixel(buf, width, height, x + w - 1 - t, py, r, g, b);
    }
  }
}

function fillRect(
  buf: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      setPixel(buf, width, height, px, py, r, g, b);
    }
  }
}

function drawText(
  buf: Buffer,
  width: number,
  height: number,
  text: string,
  startX: number,
  startY: number,
  scale: number,
  r: number,
  g: number,
  b: number,
) {
  const upper = text.toUpperCase();
  let cursorX = startX;
  for (const ch of upper) {
    const glyph = FONT_5X7[ch] ?? FONT_5X7[' '];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === '1') {
          fillRect(
            buf,
            width,
            height,
            cursorX + col * scale,
            startY + row * scale,
            scale,
            scale,
            r,
            g,
            b,
          );
        }
      }
    }
    cursorX += 6 * scale;
  }
}

function applyBoxBlur(src: Buffer, width: number, height: number, radius: number, passes: number): Buffer {
  let current = Buffer.from(src);
  for (let p = 0; p < passes; p++) {
    const next = Buffer.alloc(current.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = Math.min(height - 1, Math.max(0, y + dy));
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = Math.min(width - 1, Math.max(0, x + dx));
            const idx = (ny * width + nx) * 4;
            sumR += current[idx];
            sumG += current[idx + 1];
            sumB += current[idx + 2];
            count++;
          }
        }
        const outIdx = (y * width + x) * 4;
        next[outIdx] = Math.round(sumR / count);
        next[outIdx + 1] = Math.round(sumG / count);
        next[outIdx + 2] = Math.round(sumB / count);
        next[outIdx + 3] = 255;
      }
    }
    current = next;
  }
  return current;
}

function injectPngTextChunk(pngBuffer: Buffer, keyword: string, text: string): Buffer {
  // Insert a valid PNG tEXt chunk right before IEND (last 12 bytes)
  const keyBuf = Buffer.from(keyword, 'latin1');
  const valBuf = Buffer.from(text, 'latin1');
  const data = Buffer.concat([keyBuf, Buffer.from([0]), valBuf]);
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from('tEXt', 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);

  let crc = 0xffffffff;
  for (let i = 0; i < crcInput.length; i++) {
    crc ^= crcInput[i];
    for (let b = 0; b < 8; b++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);

  const chunk = Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
  const iendOffset = pngBuffer.length - 12;
  return Buffer.concat([pngBuffer.subarray(0, iendOffset), chunk, pngBuffer.subarray(iendOffset)]);
}

export interface SampleDocAsset {
  kind: SampleDocKind;
  fileName: string;
  mimeType: string;
  label: string;
  description: string;
  buffer: Buffer;
}

export function generateSampleDocPng(kind: SampleDocKind): SampleDocAsset {
  const width = 640;
  const height = 420;
  const png = new PNG({ width, height });
  fillRect(png.data, width, height, 0, 0, width, height, 248, 250, 252);

  let fileName = '2025_Form_W2_Sample.png';
  let label = 'Crisp 2025 W-2';
  let description = 'Valid high-resolution 2025 Form W-2';
  let metaText = 'FORM W-2 WAGE AND TAX STATEMENT TAX YEAR 2025';

  if (kind === 'w2_2025_crisp' || kind === 'w2_2025_blurry') {
    drawRect(png.data, width, height, 24, 24, width - 48, height - 48, 15, 23, 42, 3);
    fillRect(png.data, width, height, 24, 24, width - 48, 56, 15, 23, 42);
    drawText(png.data, width, height, 'FORM W-2 WAGE AND TAX STATEMENT', 44, 42, 2, 255, 255, 255);
    drawText(png.data, width, height, '2025', 520, 40, 3, 16, 185, 129);
    drawRect(png.data, width, height, 44, 100, 270, 90, 100, 116, 139, 2);
    drawRect(png.data, width, height, 326, 100, 270, 90, 100, 116, 139, 2);
    drawText(png.data, width, height, 'BOX 1 WAGES', 58, 116, 2, 71, 85, 105);
    drawText(png.data, width, height, '$94,250.00', 58, 148, 3, 15, 23, 42);
    drawText(png.data, width, height, 'BOX 2 FED TAX', 340, 116, 2, 71, 85, 105);
    drawText(png.data, width, height, '$16,840.00', 340, 148, 3, 15, 23, 42);
    drawRect(png.data, width, height, 44, 210, 552, 84, 100, 116, 139, 2);
    drawText(png.data, width, height, 'EMPLOYER: ACME LABS INC', 58, 228, 2, 15, 23, 42);
    drawText(png.data, width, height, 'TAX YEAR 2025  VERIFIED COPY', 58, 260, 2, 15, 23, 42);
    drawText(png.data, width, height, 'BOX 12A CODE DD  $6,400.00', 58, 324, 2, 51, 65, 85);

    if (kind === 'w2_2025_blurry') {
      png.data = applyBoxBlur(png.data, width, height, 6, 3);
      fileName = 'blurry_w2_phone_snap.png';
      label = 'Blurry W-2 Photo';
      description = 'Motion-blurred phone camera photo (fails sharpness check)';
    }
  } else if (kind === 'w2_2024_wrong_year') {
    drawRect(png.data, width, height, 24, 24, width - 48, height - 48, 15, 23, 42, 3);
    fillRect(png.data, width, height, 24, 24, width - 48, 56, 30, 41, 59);
    drawText(png.data, width, height, 'FORM W-2 WAGE AND TAX STATEMENT', 44, 42, 2, 255, 255, 255);
    drawText(png.data, width, height, '2024', 520, 40, 3, 245, 158, 11);
    drawRect(png.data, width, height, 44, 100, 270, 90, 100, 116, 139, 2);
    drawText(png.data, width, height, 'BOX 1 WAGES', 58, 116, 2, 71, 85, 105);
    drawText(png.data, width, height, '$88,100.00', 58, 148, 3, 15, 23, 42);
    drawRect(png.data, width, height, 44, 210, 552, 84, 100, 116, 139, 2);
    drawText(png.data, width, height, 'EMPLOYER: ACME LABS INC', 58, 228, 2, 15, 23, 42);
    drawText(png.data, width, height, 'PRIOR TAX YEAR 2024 RETURN', 58, 260, 2, 180, 83, 9);
    fileName = 'W2_2024_Prior_Year.png';
    label = 'Wrong Year (2024 W-2)';
    description = 'Crisp photo, but wrong tax year (2024 instead of 2025)';
    metaText = 'FORM W-2 WAGE AND TAX STATEMENT TAX YEAR 2024';
  } else if (kind === 'bank_2025_crisp') {
    drawRect(png.data, width, height, 24, 24, width - 48, height - 48, 15, 23, 42, 2);
    fillRect(png.data, width, height, 24, 24, width - 48, 58, 16, 78, 99);
    drawText(png.data, width, height, 'MERIDIAN BANK STATEMENT', 44, 42, 2, 255, 255, 255);
    drawText(png.data, width, height, 'DEC 2025', 490, 42, 2, 167, 243, 208);
    drawText(png.data, width, height, 'CHECKING ACCOUNT SUMMARY', 48, 112, 2, 15, 23, 42);
    drawText(png.data, width, height, 'PERIOD: 12-01-2025 TO 12-31-2025', 48, 152, 2, 51, 65, 85);
    drawRect(png.data, width, height, 48, 196, 544, 100, 148, 163, 184, 2);
    drawText(png.data, width, height, 'ENDING BALANCE: $28,490.15', 64, 222, 2, 15, 23, 42);
    drawText(png.data, width, height, 'ACCOUNT ENDING 4829', 64, 258, 2, 71, 85, 105);
    fileName = '2025_Bank_Statement.png';
    label = 'Crisp 2025 Bank Statement';
    description = 'Valid year-end bank statement for 2025';
    metaText = 'BANK STATEMENT CHECKING ACCOUNT 2025';
  } else if (kind === 'gov_id_crisp') {
    fillRect(png.data, width, height, 40, 40, width - 80, height - 80, 239, 246, 255);
    drawRect(png.data, width, height, 40, 40, width - 80, height - 80, 30, 58, 138, 3);
    fillRect(png.data, width, height, 40, 40, width - 80, 56, 30, 58, 138);
    drawText(png.data, width, height, 'STATE DRIVER LICENSE ID', 64, 58, 2, 255, 255, 255);
    fillRect(png.data, width, height, 68, 126, 130, 160, 203, 213, 225);
    drawRect(png.data, width, height, 68, 126, 130, 160, 71, 85, 105, 2);
    drawText(png.data, width, height, 'PHOTO', 98, 196, 2, 51, 65, 85);
    drawText(png.data, width, height, 'ID NO: D84920194', 226, 132, 2, 15, 23, 42);
    drawText(png.data, width, height, 'EXP: 08-14-2029', 226, 174, 2, 15, 23, 42);
    drawText(png.data, width, height, 'CLASS C VERIFIED', 226, 216, 2, 16, 185, 129);
    fileName = 'Government_Driver_License_ID.png';
    label = 'Crisp Driver License ID';
    description = 'Valid government photo ID with crisp borders';
    metaText = 'GOVERNMENT PHOTO ID DRIVER LICENSE';
  }

  const rawBuffer = PNG.sync.write(png);
  const buffer = injectPngTextChunk(rawBuffer, 'Description', metaText);
  return {
    kind,
    fileName,
    mimeType: 'image/png',
    label,
    description,
    buffer,
  };
}
