// SPDX-License-Identifier: GPL-3.0-only
/**
 * Pooyan video tests (no ROM needed: hand-crafted synthetic bytes, exact-decode asserts). Covers
 * decodeTiles/decodeSprites 4bpp unpack (vs an INDEPENDENT decoder from pooyan.cpp's gfx_layout,
 * fuzzed + hand-computed fixtures), the 32 base resnet colours, buildPalette char/sprite lookups,
 * and renderRowsRGB (single-layer, flipX/Y, sprite pen-0 transparency, ASCENDING sprite priority).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeTiles, decodeSprites, baseColours, buildPalette, splitProms,
  RWEIGHTS, GWEIGHTS, BWEIGHTS, PROM_SIZE, PALETTE_SIZE, SPRITE_PEN_BASE,
  renderRowsRGB, SCREEN_W, VISIBLE_Y0,
} from "../video.js";

// Independent reference decoder, the literal MAME way (pooyan.cpp:379-399): pen bit p (p=0 MSB) at
// ROM bit code*charBits + planeoffset[p] + yoff[y] + xoff[x]; readbit(n) = (rom[n>>3]>>(7-(n&7)))&1
// (MAME bit 0 = byte MSB); planeoffset {RGN_FRAC(1,2)+4, +0, 4, 0}, RGN_FRAC(1,2) = rom.length*8/2.
function refDecode(rom, { w, h, charBits, xoff, yoff }) {
  const half = (rom.length * 8) / 2; // RGN_FRAC(1,2) in bits
  const plane = [half + 4, half + 0, 4, 0]; // plane[0] = MSB
  const readbit = (n) => (rom[n >> 3] >> (7 - (n & 7))) & 1;
  const count = ((rom.length >> 1) * 8 / charBits) | 0;
  const out = new Uint8Array(count * w * h);
  for (let code = 0; code < count; code++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let pen = 0;
        for (let p = 0; p < 4; p++) {
          pen |= readbit(code * charBits + plane[p] + yoff[y] + xoff[x]) << (3 - p);
        }
        out[code * w * h + y * w + x] = pen;
      }
    }
  }
  return out;
}

const CHAR_LAYOUT = {
  w: 8, h: 8, charBits: 16 * 8,
  xoff: [0, 1, 2, 3, 64, 65, 66, 67], // STEP4(0,1), STEP4(8*8,1)
  yoff: [0, 8, 16, 24, 32, 40, 48, 56], // STEP8(0,8)
};
const SPRITE_LAYOUT = {
  w: 16, h: 16, charBits: 64 * 8,
  xoff: [0, 1, 2, 3, 64, 65, 66, 67, 128, 129, 130, 131, 192, 193, 194, 195],
  yoff: [0, 8, 16, 24, 32, 40, 48, 56, 256, 264, 272, 280, 288, 296, 304, 312],
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

test("decodeTiles matches the independent MAME-layout reference over random ROMs", () => {
  for (const seed of [1, 2, 3]) {
    const rom = randRom(0x2000, seed); // real Pooyan tiles region size (8KB = 256 tiles)
    assert.deepEqual(decodeTiles(rom), refDecode(rom, CHAR_LAYOUT), `seed ${seed}`);
  }
});

test("decodeSprites matches the independent MAME-layout reference over random ROMs", () => {
  for (const seed of [7, 8, 9]) {
    const rom = randRom(0x2000, seed); // 8KB sprites region = 64 sprites
    assert.deepEqual(decodeSprites(rom), refDecode(rom, SPRITE_LAYOUT), `seed ${seed}`);
  }
});

test("decodeTiles: explicit hand-computed pixels prove plane/nibble/half placement", () => {
  const rom = new Uint8Array(32); // 1 tile: 16 bytes half0 + 16 half1
  rom[0] = 0x88;   // (0,0) half0: bit7->pen b0, bit3->pen b1
  rom[16] = 0x80;  // (0,0) half1: bit7->pen b2
  rom[8] = 0x11;   // (7,0): right group byte +8, bit4/bit0 -> pens 0,1
  rom[1] = 0x40;   // (1,1): row1 byte1, bit6 -> pen b0
  const t = decodeTiles(rom); // 1 tile, 64 pixels
  const px = (x, y) => t[y * 8 + x];
  assert.equal(px(0, 0), 0b0111, "(0,0): b0|b1 from half0 + b2 from half1 = 7");
  assert.equal(px(1, 0), 0, "(1,0) untouched");
  assert.equal(px(7, 0), 0b0011, "(7,0): right-half byte, LSB column = 3");
  assert.equal(px(1, 1), 0b0001, "(1,1): row 1, column 1 = pen 1");
  assert.equal(px(0, 1), 0, "(0,1) untouched");
});

test("decodeTiles: the SECOND ROM half carries the two HIGH pen bits (drop it -> pens 0..3)", () => {
  const rom = new Uint8Array(32);
  rom[0] = 0xff;  // first half: pen bits 0,1 set for x=0..3 (high+low nibble)
  // second half all zero -> pens capped to the low two bits
  const t = decodeTiles(rom);
  assert.equal(t[0], 0b0011, "(0,0) with empty high half = 3");
  rom[16] = 0xff; // now high half sets pen bits 2,3 too for x=0..3
  const t2 = decodeTiles(rom);
  assert.equal(t2[0], 0b1111, "(0,0) with full high half = 15");
});

test("decodeSprites: hand-computed pixels for one 16x16 sprite", () => {
  const rom = new Uint8Array(128); // 64 bytes/half, 1 sprite
  rom[0] = 0x88;   // (0,0) half0 byte0: bit7->b0, bit3->b1
  rom[64] = 0x88;  // (0,0) half1 byte64 -> b2,b3
  rom[8] = 0x80;   // (4,0): x>>2=1 -> byte8, bit7->b0
  rom[32] = 0x80;  // (0,8): y>=8 -> yByte 32, bit7->b0
  const s = decodeSprites(rom);
  const px = (x, y) => s[y * 16 + x];
  assert.equal(px(0, 0), 0b1111, "(0,0) all four planes = 15");
  assert.equal(px(4, 0), 0b0001, "(4,0) second x-group, byte +8 = 1");
  assert.equal(px(0, 8), 0b0001, "(0,8) bottom half, yByte y+24 = 1");
  assert.equal(px(1, 0), 0, "(1,0) untouched");
});

test("decode derives element count from ROM length (smaller synthetic images work)", () => {
  assert.equal(decodeTiles(new Uint8Array(64)).length, 2 * 64, "64 bytes -> 2 tiles");
  assert.equal(decodeSprites(new Uint8Array(256)).length, 2 * 256, "256 bytes -> 2 sprites");
  // pens never exceed 15
  const t = decodeTiles(randRom(0x2000, 42));
  assert.ok(t.every((p) => p <= 15));
});

// --- Palette ---
test("resnet weights: RG = [~33.23, ~70.71, ~151.06] summing to 255; B = [~79.92, ~170.75]", () => {
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.05, `${msg}: ${a} vs ${b}`);
  near(RWEIGHTS[0], 33.234, "R w0"); near(RWEIGHTS[1], 70.709, "R w1"); near(RWEIGHTS[2], 151.058, "R w2");
  near(RWEIGHTS[0] + RWEIGHTS[1] + RWEIGHTS[2], 255, "R sum");
  assert.deepEqual([...GWEIGHTS], [...RWEIGHTS], "green net identical to red");
  near(BWEIGHTS[0], 79.923, "B w0"); near(BWEIGHTS[1], 170.749, "B w1");
});

test("baseColours: 32 base RGB triples match the hand calc (r=bits0-2, g=bits3-5, b=bits6-7)", () => {
  const proms = new Uint8Array(32);
  const set = (i, v) => { proms[i] = v; }; // single-bit + full-channel probes at distinct base indices
  set(0, 0x00); set(1, 0x01); set(2, 0x02); set(3, 0x04); set(4, 0x07); // red
  set(5, 0x08); set(6, 0x10); set(7, 0x20); set(8, 0x38);
  set(9, 0x40); set(10, 0x80); set(11, 0xc0); // blue
  set(12, 0xff);
  const b = baseColours(proms);
  assert.deepEqual(b[0], [0, 0, 0]);
  assert.deepEqual(b[1], [33, 0, 0], "bit0 -> R=33 (weakest resistor)");
  assert.deepEqual(b[2], [71, 0, 0], "bit1 -> R=71");
  assert.deepEqual(b[3], [151, 0, 0], "bit2 -> R=151 (strongest)");
  assert.deepEqual(b[4], [255, 0, 0], "bits0-2 -> R=255");
  assert.deepEqual(b[5], [0, 33, 0], "bit3 -> G=33");
  assert.deepEqual(b[6], [0, 71, 0], "bit4 -> G=71");
  assert.deepEqual(b[7], [0, 151, 0], "bit5 -> G=151");
  assert.deepEqual(b[8], [0, 255, 0], "bits3-5 -> G=255");
  assert.deepEqual(b[9], [0, 0, 80], "bit6 -> B=80");
  assert.deepEqual(b[10], [0, 0, 171], "bit7 -> B=171");
  assert.deepEqual(b[11], [0, 0, 251], "bits6-7 -> B=251 (2-bit channel tops out dimmer)");
  assert.deepEqual(b[12], [255, 255, 251], "0xFF -> full white-ish");
});

test("buildPalette: char pens use base[(pr3&0x0f)|0x10], sprite pens use base[pr2&0x0f]", () => {
  const proms = new Uint8Array(PROM_SIZE);
  proms[0x02] = 0x07; // base[0x02] = (255,0,0), sprite target
  proms[0x12] = 0x38; // base[0x12] = (0,255,0), char target
  const base = baseColours(proms);
  assert.deepEqual(base[0x02], [255, 0, 0]);
  assert.deepEqual(base[0x12], [0, 255, 0]);
  const { charLut, spriteLut } = splitProms(proms);
  charLut[5] = 0xa2;   // low nibble 2 (high nibble ignored) -> base index (2|0x10)=0x12
  spriteLut[9] = 0xf2; // low nibble 2 -> base index 0x02 -> (255,0,0)
  const pal = buildPalette(proms);
  const pen = (i) => [pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2]];
  assert.deepEqual(pen(5), [0, 255, 0], "char pen 5 -> base[(0xA2&0x0f)|0x10]=base[0x12]");
  assert.deepEqual(pen(SPRITE_PEN_BASE + 9), [255, 0, 0], "sprite pen 9 -> base[0xF2&0x0f]=base[0x02]");
  assert.equal(pal.length, PALETTE_SIZE * 3, "512 pens * 3");
});

test("splitProms rejects a wrong-sized PROM region", () => {
  assert.throws(() => splitProms(new Uint8Array(543)), /544 bytes/);
});

// --- Renderer (single layer, flip, sprite transparency + ascending priority) ---
// Screen row 0 is native row 16 (VISIBLE_Y0): ny=16 -> cellRow = (16>>3)*32 = 64.
const CELL0 = ((VISIBLE_Y0 >> 3) * 32) + 0; // 64, column 0

function blankGfx() {
  return {
    tiles: new Uint8Array(256 * 64),
    sprites: new Uint8Array(64 * 256),
    palette: new Uint8Array(PALETTE_SIZE * 3),
  };
}
function setPen(pal, pen, rgb) { pal[pen * 3] = rgb[0]; pal[pen * 3 + 1] = rgb[1]; pal[pen * 3 + 2] = rgb[2]; }
function pixel(out, x) { const o = x * 3; return [out[o], out[o + 1], out[o + 2]]; }
const blankMem = () => ({
  colorRam: new Uint8Array(1024), videoRam: new Uint8Array(1024),
  sprite0: new Uint8Array(256), sprite1: new Uint8Array(256),
});

test("render: a tile draws opaquely; attr bit 4 has NO priority effect (single layer)", () => {
  const gfx = blankGfx(), mem = blankMem();
  mem.colorRam[CELL0] = 0x11; // colour 1, AND bit 4 set (timeplt's category bit -- inert here)
  mem.videoRam[CELL0] = 3;    // tile code 3
  gfx.tiles[3 * 64 + 0] = 5;  // pen 5 at (0,0)
  setPen(gfx.palette, 1 * 16 + 5, [11, 22, 33]); // char pen colour1*16 + 5
  const out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx);
  assert.deepEqual(pixel(out, 0), [11, 22, 33], "tile drawn regardless of attr bit 4");
});

test("render: tile flipX and flipY mirror the source", () => {
  const gfx = blankGfx();
  gfx.tiles[3 * 64 + 0 * 8 + 7] = 5; // pen 5 at (x=7,y=0)
  gfx.tiles[3 * 64 + 7 * 8 + 0] = 6; // pen 6 at (x=0,y=7)
  setPen(gfx.palette, 1 * 16 + 5, [50, 0, 0]);
  setPen(gfx.palette, 1 * 16 + 6, [0, 60, 0]);

  // flipX (attr bit 6): screen x=0 should read source x=7 -> pen 5
  let mem = blankMem();
  mem.colorRam[CELL0] = 0x41; mem.videoRam[CELL0] = 3;
  let out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx);
  assert.deepEqual(pixel(out, 0), [50, 0, 0], "flipX: x0 <- source x7");

  // flipY (attr bit 7): screen row 0 (tileY 0) should read source row 7 -> pen 6 at x0
  mem = blankMem();
  mem.colorRam[CELL0] = 0x81; mem.videoRam[CELL0] = 3;
  out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx);
  assert.deepEqual(pixel(out, 0), [0, 60, 0], "flipY: row0 <- source row7");
});

test("render: sprite overlays the tile; pen 0 is transparent so the tile shows through", () => {
  const gfx = blankGfx(), mem = blankMem();
  mem.colorRam[CELL0] = 0x01; mem.videoRam[CELL0] = 3; // tile bg colour 1
  gfx.tiles[3 * 64 + 0] = 6; gfx.tiles[3 * 64 + 1] = 6;
  setPen(gfx.palette, 1 * 16 + 6, [7, 7, 7]);

  // Sprite offs 0x10, code 7, colour 2, sy=240-224=16 (top row at output row 0), sx=0, no flip.
  mem.sprite0[0x10] = 0; mem.sprite0[0x11] = 7;
  mem.sprite1[0x10] = 0x42; mem.sprite1[0x11] = 224;
  gfx.sprites[7 * 256 + 0] = 9; // (0,0) pen 9 opaque
  gfx.sprites[7 * 256 + 1] = 0; // (1,0) pen 0 transparent
  setPen(gfx.palette, SPRITE_PEN_BASE + 2 * 16 + 9, [90, 90, 90]);

  const out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx);
  assert.deepEqual(pixel(out, 0), [90, 90, 90], "sprite opaque pen over tile");
  assert.deepEqual(pixel(out, 1), [7, 7, 7], "sprite pen 0 transparent -> tile shows");
});

test("render: ASCENDING sprite priority -- the HIGHEST offset wins overlap (opposite of timeplt)", () => {
  const gfx = blankGfx(), mem = blankMem();
  // Two sprites at sx=0 sy=16 overlapping (0,0): lower offs 0x10 (colour 2 pen 9), higher 0x12 (colour 3 pen 3).
  mem.sprite0[0x10] = 0; mem.sprite0[0x11] = 7; mem.sprite1[0x10] = 0x42; mem.sprite1[0x11] = 224;
  mem.sprite0[0x12] = 0; mem.sprite0[0x13] = 8; mem.sprite1[0x12] = 0x43; mem.sprite1[0x13] = 224;
  gfx.sprites[7 * 256 + 0] = 9;
  gfx.sprites[8 * 256 + 0] = 3;
  setPen(gfx.palette, SPRITE_PEN_BASE + 2 * 16 + 9, [20, 20, 20]); // offs 0x10 colour
  setPen(gfx.palette, SPRITE_PEN_BASE + 3 * 16 + 3, [80, 80, 80]); // offs 0x12 colour
  const out = new Uint8Array(SCREEN_W * 3);
  renderRowsRGB(out, 0, 0, mem, gfx);
  assert.deepEqual(pixel(out, 0), [80, 80, 80], "higher offset 0x12 painted last -> wins");
});
