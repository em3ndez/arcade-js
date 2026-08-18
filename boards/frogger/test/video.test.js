// SPDX-License-Identifier: GPL-3.0-only
/**
 * Frogger video tests -- the largest delta from our konami/ boards. No ROM/PROM image needed: every
 * check feeds hand-crafted synthetic bytes and asserts the exact decode/transform. The key arm is
 * decodeTiles/decodeSprites vs an INDEPENDENT decoder written straight from the galaxian gfx_layout
 * (planeoffset { RGN_FRAC(0,2), RGN_FRAC(1,2) } + STEP macros), fuzzed + hand-computed pixels. The rest
 * cover froggerNibbleSwap/Extend, resnet at RGB_MAXIMUM=224/pulldown 470, palette, sprite geometry, and
 * the renderer (background split, transparent pen 0, low-index-wins, x<17 clip); each test names its own.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeTiles, decodeSprites, froggerNibbleSwap, froggerExtendColor,
  baseColours, buildPalette, spriteAttrs,
  RWEIGHTS, GWEIGHTS, BWEIGHTS, RGB_MAXIMUM, PALETTE_SIZE, PENS_PER_CELL,
  renderRowsRGB, SCREEN_W, VISIBLE_Y0, BACKGROUND_BLUE, SPRITE_CLIP_LEFT,
} from "../video.js";

// pen bit p (p=0 is MSB) at bit address code*charBits + planeoffset[p] + yoff[y] + xoff[x].
// planeoffset = { RGN_FRAC(0,2)=0, RGN_FRAC(1,2)=halfBits }. readbit: MAME bit 0 = byte MSB.
function refDecode(rom, { w, h, charBits, xoff, yoff }) {
  const halfBits = (rom.length * 8) / 2;
  const plane = [0, halfBits]; // plane[0] = MSB (first half), plane[1] = LSB (second half)
  const readbit = (n) => (rom[n >> 3] >> (7 - (n & 7))) & 1;
  const count = ((rom.length >> 1) * 8 / charBits) | 0;
  const out = new Uint8Array(count * w * h);
  for (let code = 0; code < count; code++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let pen = 0;
        for (let p = 0; p < 2; p++) {
          pen |= readbit(code * charBits + plane[p] + yoff[y] + xoff[x]) << (1 - p);
        }
        out[code * w * h + y * w + x] = pen;
      }
    }
  }
  return out;
}

const CHAR_LAYOUT = { w: 8, h: 8, charBits: 8 * 8, xoff: [0, 1, 2, 3, 4, 5, 6, 7], yoff: [0, 8, 16, 24, 32, 40, 48, 56] };
const SPRITE_LAYOUT = {
  w: 16, h: 16, charBits: 16 * 16,
  xoff: [0, 1, 2, 3, 4, 5, 6, 7, 64, 65, 66, 67, 68, 69, 70, 71],
  yoff: [0, 8, 16, 24, 32, 40, 48, 56, 128, 136, 144, 152, 160, 168, 176, 184],
};

function randRom(bytes, seed) {
  let s = seed >>> 0;
  const r = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    r[i] = (s >>> 16) & 0xff;
  }
  return r;
}

test("decodeTiles matches the independent galaxian-layout reference over random ROMs", () => {
  for (const seed of [1, 2, 3]) {
    const rom = randRom(0x1000, seed); // real gfx1 size: two 0x800 halves -> 256 tiles
    assert.deepEqual(decodeTiles(rom), refDecode(rom, CHAR_LAYOUT), `seed ${seed}`);
  }
});

test("decodeSprites matches the independent galaxian-layout reference over random ROMs", () => {
  for (const seed of [7, 8, 9]) {
    const rom = randRom(0x1000, seed); // 0x800 half / 32 bytes -> 64 sprites
    assert.deepEqual(decodeSprites(rom), refDecode(rom, SPRITE_LAYOUT), `seed ${seed}`);
  }
});

test("decodeTiles: hand-computed pixels prove plane/half placement (first half = MSB)", () => {
  const rom = new Uint8Array(16); // half=8 -> 1 tile
  rom[0] = 0b10000000; // (0,0): first-half bit7 -> MSB set -> pen 2
  rom[8] = 0b01000000; // (1,0): second-half bit6 -> LSB set at x=1 -> pen 1
  rom[1] = 0b00000001; // (7,1): first-half bit0 -> MSB set at x=7 -> pen 2
  const t = decodeTiles(rom);
  const px = (x, y) => t[y * 8 + x];
  assert.equal(px(0, 0), 2, "(0,0) MSB from first half");
  assert.equal(px(1, 0), 1, "(1,0) LSB from second half");
  assert.equal(px(7, 1), 2, "(7,1) row 1, x=7 MSB");
  assert.equal(px(2, 0), 0, "(2,0) untouched");
});

test("decodeTiles: the SECOND ROM half carries the HIGH (MSB) plane... no, first is MSB -- verify both", () => {
  const rom = new Uint8Array(16);
  rom[0] = 0xff; // first half (MSB) set for x=0..7 -> pen bit1 set everywhere on row 0
  const t1 = decodeTiles(rom);
  assert.equal(t1[0], 2, "(0,0) only MSB -> pen 2");
  rom[8] = 0xff; // second half (LSB) too -> pen 3
  const t2 = decodeTiles(rom);
  assert.equal(t2[0], 3, "(0,0) both planes -> pen 3");
});

test("decodeSprites: hand-computed pixels for one 16x16 sprite", () => {
  const rom = new Uint8Array(64); // half=32 -> 1 sprite
  rom[0] = 0x80;  // (0,0): loByte 0 bit7 -> MSB -> pen 2
  rom[8] = 0x80;  // (8,0): x>=8 -> xByte 8, loByte 8 bit7 -> pen 2
  rom[16] = 0x80; // (0,8): y>=8 -> yByte 16, loByte 16 bit7 -> pen 2
  rom[32] = 0x80; // second half (0,0) LSB -> makes (0,0) pen 3
  const s = decodeSprites(rom);
  const px = (x, y) => s[y * 16 + x];
  assert.equal(px(0, 0), 3, "(0,0) both planes = 3");
  assert.equal(px(8, 0), 2, "(8,0) second x-group, byte +8");
  assert.equal(px(0, 8), 2, "(0,8) bottom half, yByte y+8");
  assert.equal(px(1, 0), 0, "(1,0) untouched");
});

test("decode derives element count from ROM length (smaller synthetic images work); pens <= 3", () => {
  assert.equal(decodeTiles(new Uint8Array(16)).length, 1 * 64, "16 bytes -> 1 tile");
  assert.equal(decodeSprites(new Uint8Array(128)).length, 2 * 256, "128 bytes -> 2 sprites");
  const t = decodeTiles(randRom(0x1000, 42));
  assert.ok(t.every((p) => p <= 3), "2bpp -> pens never exceed 3");
});


test("froggerNibbleSwap exchanges the top and bottom 4 bits and is its own inverse", () => {
  assert.equal(froggerNibbleSwap(0x12), 0x21);
  assert.equal(froggerNibbleSwap(0xf0), 0x0f);
  assert.equal(froggerNibbleSwap(0x3c), 0xc3);
  for (let v = 0; v < 256; v++) assert.equal(froggerNibbleSwap(froggerNibbleSwap(v)), v);
});

test("froggerExtendColor is a 3-bit ROTATE-RIGHT: 0..7 -> 0,4,1,5,2,6,3,7 (tiles AND sprites)", () => {
  const got = [0, 1, 2, 3, 4, 5, 6, 7].map(froggerExtendColor);
  assert.deepEqual(got, [0, 4, 1, 5, 2, 6, 3, 7]);
});


test("★ resnet with RGB_MAXIMUM=224 & pulldown 470: R/G weights sum 224, blue sums 217", () => {
  assert.equal(RGB_MAXIMUM, 224);
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.05, `${msg}: ${a} vs ${b}`);
  near(RWEIGHTS[0], 29.193, "R w0"); near(RWEIGHTS[1], 62.112, "R w1"); near(RWEIGHTS[2], 132.695, "R w2");
  near(RWEIGHTS[0] + RWEIGHTS[1] + RWEIGHTS[2], 224, "R sum -> RGB_MAXIMUM");
  assert.deepEqual([...GWEIGHTS], [...RWEIGHTS], "green net identical to red");
  near(BWEIGHTS[0], 69.170, "B w0"); near(BWEIGHTS[1], 147.772, "B w1");
  // Raw blue sum is 216.94; combine_weights rounds it to the 217 pen value (see baseColours b[9]).
  near(BWEIGHTS[0] + BWEIGHTS[1], 216.942, "B raw sum (2-bit channel dimmer than 224; -> pen 217)");
});

test("baseColours: 32 triples match the hand calc with RGB_MAXIMUM=224 (r=b0-2,g=b3-5,b=b6-7)", () => {
  const proms = new Uint8Array(PALETTE_SIZE);
  proms[0] = 0x00; proms[1] = 0x01; proms[2] = 0x02; proms[3] = 0x04; proms[4] = 0x07; // red
  proms[5] = 0x08; proms[6] = 0x38;                                                    // green
  proms[7] = 0x40; proms[8] = 0x80; proms[9] = 0xc0;                                   // blue
  proms[10] = 0xff;                                                                    // all
  const b = baseColours(proms);
  assert.deepEqual(b[0], [0, 0, 0]);
  assert.deepEqual(b[1], [29, 0, 0], "bit0 -> R=29 (weakest resistor, NOT 33 as at maxval 255)");
  assert.deepEqual(b[2], [62, 0, 0], "bit1 -> R=62");
  assert.deepEqual(b[3], [133, 0, 0], "bit2 -> R=133");
  assert.deepEqual(b[4], [224, 0, 0], "bits0-2 -> R=224 = RGB_MAXIMUM");
  assert.deepEqual(b[5], [0, 29, 0], "bit3 -> G=29");
  assert.deepEqual(b[6], [0, 224, 0], "bits3-5 -> G=224");
  assert.deepEqual(b[7], [0, 0, 69], "bit6 -> B=69");
  assert.deepEqual(b[8], [0, 0, 148], "bit7 -> B=148");
  assert.deepEqual(b[9], [0, 0, 217], "bits6-7 -> B=217");
  assert.deepEqual(b[10], [224, 224, 217], "0xFF -> white-ish, dimmer than 255");
});

test("buildPalette: 32 pens, each pen i is PROM byte i's resnet (no char/sprite LUT)", () => {
  const proms = new Uint8Array(PALETTE_SIZE);
  proms[5] = 0x38;
  proms[9] = 0x04;
  const pal = buildPalette(proms);
  assert.equal(pal.length, PALETTE_SIZE * 3);
  const pen = (i) => [pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2]];
  assert.deepEqual(pen(5), [0, 224, 0], "pen 5 direct from PROM[5]");
  assert.deepEqual(pen(9), [133, 0, 0], "pen 9 direct from PROM[9]");
  assert.deepEqual(pen(0), [0, 0, 0]);
});


test("spriteAttrs: nibble-swap Y, sprnum<3 gets sy=240-(base0-1), +1 sprite X, code/flip/color", () => {
  const obj = new Uint8Array(256);
  // sprnum 0 (base 0x40): raw Y 0x30 -> swap 0x03 -> base0=3 -> sy = 240-(3-1) = 238
  obj[0x40] = 0x30;
  obj[0x41] = 0x40 | 0x05; // code 5, flipx set, flipy clear
  obj[0x42] = 0x02;        // color raw 2 -> extend 1
  obj[0x43] = 0x10;        // sx = 0x10 + 1 = 17
  const a = spriteAttrs(obj, 0);
  assert.deepEqual(a, { sx: 17, sy: 238, code: 5, color: 1, flipx: true, flipy: false });

  // sprnum 3 (base 0x4C): same raw Y -> NO -1 -> sy = 240-3 = 237
  obj[0x4c] = 0x30;
  obj[0x4d] = 0x80 | 0x07; // code 7, flipy set
  obj[0x4e] = 0x04;        // color raw 4 -> extend 2
  obj[0x4f] = 0x00;        // sx = 1
  const b = spriteAttrs(obj, 3);
  assert.deepEqual(b, { sx: 1, sy: 237, code: 7, color: 2, flipx: false, flipy: true });
});

test("spriteAttrs: flipscreen mirrors sx=240-sx / sy=240-sy and toggles the flip flags", () => {
  const obj = new Uint8Array(256);
  obj[0x40] = 0x30; // base0=3 -> sy 238 (sprnum 0)
  obj[0x41] = 0x00; // code 0, no flips
  obj[0x42] = 0x00;
  obj[0x43] = 0x10; // sx 17
  const a = spriteAttrs(obj, 0, { flipScreenX: true, flipScreenY: true });
  assert.equal(a.sx, (240 - 17) & 0xff, "sx = 240 - 17");
  assert.equal(a.sy, (240 - 238) & 0xff, "sy = 240 - 238");
  assert.equal(a.flipx, true, "flipx toggled by flipscreen X");
  assert.equal(a.flipy, true, "flipy toggled by flipscreen Y");
});


function blankGfx() {
  return { tiles: new Uint8Array(256 * 64), sprites: new Uint8Array(64 * 256), palette: new Uint8Array(PALETTE_SIZE * 3) };
}
function blankMem() {
  return { videoRam: new Uint8Array(1024), objRam: new Uint8Array(256) };
}
function setPen(pal, pen, rgb) { pal[pen * 3] = rgb[0]; pal[pen * 3 + 1] = rgb[1]; pal[pen * 3 + 2] = rgb[2]; }
function pixel(out, x) { const o = x * 3; return [out[o], out[o + 1], out[o + 2]]; }

// The tilemap cell that supplies screen row 0, column 0: nativeY=16, scrollY 0 -> sourceY 16 ->
// cellY = 16>>3 = 2 -> cell = 2*32 + 0 = 64.
const CELL0 = (VISIBLE_Y0 >> 3) * 32;

test("render: background is a blue/black horizontal split at x=128 (all tiles transparent)", () => {
  const gfx = blankGfx(), mem = blankMem(); // tiles all pen 0 -> transparent -> pure background
  const out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx);
  assert.deepEqual(pixel(out, 0), BACKGROUND_BLUE, "x<128 blue");
  assert.deepEqual(pixel(out, 127), BACKGROUND_BLUE, "x=127 still blue");
  assert.deepEqual(pixel(out, 128), [0, 0, 0], "x>=128 black");
  assert.deepEqual(pixel(out, 200), [0, 0, 0]);
});

test("render: background split MIRRORS under flipScreenX", () => {
  const gfx = blankGfx(), mem = blankMem();
  const out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx, { flipScreenX: true });
  assert.deepEqual(pixel(out, 0), [0, 0, 0], "flipped: x<128 black");
  assert.deepEqual(pixel(out, 200), BACKGROUND_BLUE, "flipped: x>=128 blue");
});

test("render: a tile draws over the background; pen 0 is transparent so background shows through", () => {
  const gfx = blankGfx(), mem = blankMem();
  mem.videoRam[CELL0] = 5;         // tile code 5 at column 0
  mem.objRam[0] = 0;               // column 0 scroll-Y 0
  mem.objRam[1] = 0;               // column 0 color raw 0 -> extend 0 -> penBase 0
  gfx.tiles[5 * 64 + 0] = 3;       // pen value 3 at (0,0)
  gfx.tiles[5 * 64 + 1] = 0;       // pen 0 at (1,0) -> transparent
  setPen(gfx.palette, 0 * PENS_PER_CELL + 3, [10, 20, 30]);
  const out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx);
  assert.deepEqual(pixel(out, 0), [10, 20, 30], "tile pen 3 painted");
  assert.deepEqual(pixel(out, 1), BACKGROUND_BLUE, "tile pen 0 transparent -> background");
});

test("render: per-column scroll-Y advances the source DOWNWARD (sourceY = nativeY + scrollY) -- guards the scroll SIGN", () => {
  // Regression: a `-` here scrolled every lane backwards vs MAME; the wrong sign samples a different cell.
  const gfx = blankGfx(), mem = blankMem();
  const SCROLL = 8;
  mem.objRam[0] = froggerNibbleSwap(SCROLL);
  const cellPlus = (((VISIBLE_Y0 + SCROLL) & 0xff) >> 3) * 32;
  const cellMinus = (((VISIBLE_Y0 - SCROLL) & 0xff) >> 3) * 32;
  assert.notEqual(cellPlus, cellMinus, "the two signs must sample different cells for this test to bite");
  mem.videoRam[cellPlus] = 5;
  gfx.tiles[5 * 64 + 0] = 3;
  setPen(gfx.palette, 3, [11, 22, 33]);
  const out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx);
  assert.deepEqual(pixel(out, 0), [11, 22, 33], "screen row 0 samples nativeY+scrollY (not nativeY-scrollY)");
});

test("render: per-column color base uses odd OBJRAM byte + frogger_extend rotate", () => {
  const gfx = blankGfx(), mem = blankMem();
  mem.videoRam[CELL0] = 5;
  mem.objRam[1] = 3;               // column 0 color raw 3 -> extend(3) = 5 -> penBase 20
  gfx.tiles[5 * 64 + 0] = 2;       // pen value 2
  setPen(gfx.palette, 5 * PENS_PER_CELL + 2, [40, 50, 60]);
  const out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx);
  assert.deepEqual(pixel(out, 0), [40, 50, 60], "penBase = extend(3)*4 = 20, + pen 2 = 22");
});

test("render: sprite LOW index wins overlap (drawn 7->0), opposite of nothing -- galaxian priority", () => {
  const gfx = blankGfx(), mem = blankMem();
  // Two sprites both at sx=20, covering native row 16 (output row 0). base0=225 -> sy=16 (sprnum<3).
  const rawY = froggerNibbleSwap(225); // raw byte that swaps to 225
  // sprite 0
  mem.objRam[0x40] = rawY; mem.objRam[0x41] = 1; mem.objRam[0x42] = 2; mem.objRam[0x43] = 19; // code1,color raw2->1,sx20
  // sprite 1
  mem.objRam[0x44] = rawY; mem.objRam[0x45] = 2; mem.objRam[0x46] = 4; mem.objRam[0x47] = 19; // code2,color raw4->2,sx20
  gfx.sprites[1 * 256 + 0] = 3; // sprite 0 pixel at (0,0)
  gfx.sprites[2 * 256 + 0] = 3; // sprite 1 pixel at (0,0)
  setPen(gfx.palette, 1 * PENS_PER_CELL + 3, [1, 1, 1]); // sprite0 color 1
  setPen(gfx.palette, 2 * PENS_PER_CELL + 3, [9, 9, 9]); // sprite1 color 2
  const out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx);
  assert.deepEqual(pixel(out, 20), [1, 1, 1], "sprnum 0 painted last -> low index wins");
});

test("render: sprite line-buffer left-clip drops native x<17", () => {
  const gfx = blankGfx(), mem = blankMem();
  const rawY = froggerNibbleSwap(225); // sy=16 for sprnum 0
  mem.objRam[0x40] = rawY;
  mem.objRam[0x41] = 1;   // code 1
  mem.objRam[0x42] = 0;   // color 0 -> penBase 0
  mem.objRam[0x43] = 9;   // sx = 10 -> sprite spans x 10..25
  for (let i = 0; i < 16; i++) gfx.sprites[1 * 256 + i] = 3; // solid row
  setPen(gfx.palette, 0 * PENS_PER_CELL + 3, [7, 7, 7]);
  const out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx);
  assert.equal(SPRITE_CLIP_LEFT, 17);
  assert.deepEqual(pixel(out, 10), BACKGROUND_BLUE, "x=10 clipped -> background");
  assert.deepEqual(pixel(out, 16), BACKGROUND_BLUE, "x=16 clipped");
  assert.deepEqual(pixel(out, 17), [7, 7, 7], "x=17 drawn");
  assert.deepEqual(pixel(out, 25), [7, 7, 7], "x=25 drawn");
});
