// 외부 의존성 없이 1200x630 OG 이미지(PNG)를 생성한다.
// 사이트 테마(핑크→퍼플 대각선 그라데이션)와 통일.
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const W = 1200, H = 630;

// --- 색상 (index.html 라이트 테마 기반) ---
const A = [0xff, 0x6b, 0x8b]; // --accent  #ff6b8b
const B = [0x6a, 0x5c, 0xff]; // --accent2 #6a5cff
const topBg = [0x2b, 0x23, 0x40]; // 어두운 바탕 위 그라데이션 카드 느낌

function lerp(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

// 픽셀 버퍼 (RGB)
const px = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // 대각선 그라데이션 (135deg 느낌): 좌상 accent -> 우하 accent2
    const t = (x / W + y / H) / 2;
    let c = lerp(A, B, t);
    // 살짝 비네트로 중앙 밝게
    const dx = (x - W / 2) / (W / 2);
    const dy = (y - H / 2) / (H / 2);
    const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 1.3);
    const vign = 1 - d * 0.18;
    c = [c[0] * vign, c[1] * vign, c[2] * vign].map((v) => Math.max(0, Math.min(255, Math.round(v))));
    const i = (y * W + x) * 3;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  }
}

// --- 5x7 비트맵 폰트로 영문/숫자 텍스트 렌더 (제목은 한글이라 심볼로 대체) ---
// 간단한 블록 문자로 "jihoo.log" 로고와 큰 원형 아바타 '최'(심볼) 표현.
// 한글 글리프는 비트맵 폰트가 없어, 중앙에 큰 원 + 그 안에 흰 사각 이니셜 블록을 그려 브랜드 느낌만 전달.

function fillRect(x0, y0, w, h, color, alpha = 1) {
  for (let y = y0; y < y0 + h; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || x >= W) continue;
      const i = (y * W + x) * 3;
      px[i] = Math.round(px[i] * (1 - alpha) + color[0] * alpha);
      px[i + 1] = Math.round(px[i + 1] * (1 - alpha) + color[1] * alpha);
      px[i + 2] = Math.round(px[i + 2] * (1 - alpha) + color[2] * alpha);
    }
  }
}

function fillCircle(cx, cy, r, color, alpha = 1) {
  for (let y = cy - r; y <= cy + r; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= W) continue;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        const i = (y * W + x) * 3;
        px[i] = Math.round(px[i] * (1 - alpha) + color[0] * alpha);
        px[i + 1] = Math.round(px[i + 1] * (1 - alpha) + color[1] * alpha);
        px[i + 2] = Math.round(px[i + 2] * (1 - alpha) + color[2] * alpha);
      }
    }
  }
}

// 중앙 상단 반투명 흰 원 (아바타 느낌)
fillCircle(W / 2, 250, 110, [255, 255, 255], 0.92);
// 원 안에 그라데이션 중앙색 블록(이니셜 대체)
fillRect(W / 2 - 42, 250 - 52, 84, 104, lerp(A, B, 0.5), 1);

// --- 5x7 폰트로 영문 문구 ---
const FONT = {
  'J':['01111','00010','00010','00010','10010','10010','01100'],
  'I':['11111','00100','00100','00100','00100','00100','11111'],
  'H':['10001','10001','10001','11111','10001','10001','10001'],
  'O':['01110','10001','10001','10001','10001','10001','01110'],
  '.':['00000','00000','00000','00000','00000','00110','00110'],
  'L':['10000','10000','10000','10000','10000','10000','11111'],
  'G':['01110','10001','10000','10111','10001','10001','01111'],
  'S':['01111','10000','10000','01110','00001','00001','11110'],
  'E':['11111','10000','10000','11110','10000','10000','11111'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
  'P':['11110','10001','10001','11110','10000','10000','10000'],
  'R':['11110','10001','10001','11110','10100','10010','10001'],
  'T':['11111','00100','00100','00100','00100','00100','00100'],
  'N':['10001','11001','11001','10101','10011','10011','10001'],
  'F':['11111','10000','10000','11110','10000','10000','10000'],
  'A':['01110','10001','10001','11111','10001','10001','10001'],
  '2':['01110','10001','00001','00110','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],
  '6':['00110','01000','10000','11110','10001','10001','01110'],
};
function drawText(text, x0, y0, scale, color, alpha = 1) {
  let cx = x0;
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (g[r][c] === '1') fillRect(cx + c * scale, y0 + r * scale, scale, scale, color, alpha);
      }
    }
    cx += (5 + 1) * scale;
  }
  return cx;
}

// 로고 텍스트 "JIHOO.LOG" (상단 좌측)
drawText('JIHOO.LOG', 70, 60, 7, [255, 255, 255], 0.95);

// 큰 타이틀 라인들 (영문/숫자만 폰트 지원 → 핵심 키워드 영문으로)
drawText('PORTFOLIO', 70, 430, 14, [255, 255, 255], 1);
drawText('SPRINT 2026', 70, 540, 7, [255, 255, 255], 0.85);

// ------- PNG 인코딩 (RGB, no filter) -------
function pngEncode(width, height, rgb) {
  // raw: 각 스캔라인 앞에 filter byte(0) 추가
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type 2 = truecolor RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// CRC32
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const out = pngEncode(W, H, px);
const outPath = path.join(__dirname, '..', 'og-image.png');
fs.writeFileSync(outPath, out);
console.log('Wrote', outPath, out.length, 'bytes');
