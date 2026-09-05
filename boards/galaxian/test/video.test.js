// SPDX-License-Identifier: GPL-3.0-only
/**
 * Galaxian video-decode tests (boards/galaxian/video.js), ROM-free: the tile/sprite bitplane decode, the
 * 32-entry PROM resnet palette, sprite-attribute resolution, and the (skeleton) black background. Validated
 * against galaxian_v.cpp. ⚠ The STARFIELD is stubbed (background = black) until it lands; these tests cover
 * the parts that are real. Run: node --test boards/galaxian/test/video.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeTiles, decodeSprites, buildPalette, spriteAttrs, renderRowsRGB,
  TILE_W, TILE_H, SPRITE_W, SPRITE_H, PALETTE_SIZE, RGB_MAXIMUM,
  SCREEN_W, SCREEN_H, SPRITE_BASE,
} from "../video.js";

/* -------------------------------------------------------------------- bitplane decode dimensions */

test("decodeTiles: 256 8x8 tiles from a 0x1000 gfx1 (two 0x800 planes), pens 0..3", () => {
  const gfx = new Uint8Array(0x1000);
  // tile 0, row 0: first-half byte (MSB plane) = 0x80, second-half (LSB) = 0x00 -> leftmost pixel pen 2.
  gfx[0] = 0x80;
  gfx[0x800] = 0x00;
  // tile 0, row 1: MSB=0x00, LSB=0x80 -> leftmost pixel pen 1.
  gfx[1] = 0x00;
  gfx[0x801] = 0x80;
  const tiles = decodeTiles(gfx);
  assert.equal(tiles.length, 256 * TILE_W * TILE_H);
  assert.equal(tiles[0], 2, "row0 x0 = (MSB 1, LSB 0) -> pen 2");
  assert.equal(tiles[TILE_W], 1, "row1 x0 = (MSB 0, LSB 1) -> pen 1");
  assert.ok(tiles.every((p) => p >= 0 && p <= 3), "all pens 0..3");
});

test("decodeSprites: 64 16x16 sprites from the same 0x1000 region, pens 0..3", () => {
  const gfx = new Uint8Array(0x1000);
  const sprites = decodeSprites(gfx);
  assert.equal(sprites.length, 64 * SPRITE_W * SPRITE_H);
  assert.ok(sprites.every((p) => p === 0), "all-zero ROM -> all pen 0");
});

/* ------------------------------------------------------------------------ PROM resnet palette */

test("buildPalette: 32 pens; 0x00 is black; every channel within [0, RGB_MAXIMUM]; R/G nets identical", () => {
  const proms = new Uint8Array(PALETTE_SIZE);
  proms[0] = 0x00; // black
  proms[1] = 0x07; // R bits 0-2 all on
  proms[2] = 0x38; // G bits 3-5 all on
  proms[3] = 0xc0; // B bits 6-7 all on
  proms[4] = 0xff; // all on
  const pal = buildPalette(proms);
  assert.equal(pal.length, PALETTE_SIZE * 3);
  assert.deepEqual([pal[0], pal[1], pal[2]], [0, 0, 0], "PROM 0x00 -> black");
  // pen1 all-red: R>0, G=0, B=0. pen2 all-green mirrors pen1's R (identical net).
  assert.ok(pal[3] > 0 && pal[4] === 0 && pal[5] === 0, "0x07 -> pure red");
  assert.ok(pal[6] === 0 && pal[7] > 0 && pal[8] === 0, "0x38 -> pure green");
  assert.equal(pal[3], pal[7], "R and G nets are identical (0x07 red == 0x38 green)");
  assert.ok(pal[9] === 0 && pal[10] === 0 && pal[11] > 0, "0xC0 -> pure blue");
  // resnet ceiling: nothing exceeds RGB_MAXIMUM; 2-bit blue is dimmer than 3-bit red at full-on.
  for (let i = 0; i < pal.length; i++) assert.ok(pal[i] <= RGB_MAXIMUM, `pen byte ${i} <= ${RGB_MAXIMUM}`);
  assert.ok(pal[11] <= pal[3], "2-bit blue full-on <= 3-bit red full-on");
  assert.throws(() => buildPalette(new Uint8Array(8)), /at least 32/);
});

/* ------------------------------------------------------------------------ sprite attributes */

test("spriteAttrs: sy=240-(base0-(n<3?1:0)), code&0x3f, color&7, sx=base3+1 (galaxian_v.cpp:568)", () => {
  const obj = new Uint8Array(0x100);
  const base = SPRITE_BASE + 0 * 4; // sprite 0 (n<3 -> the -1 adjust)
  obj[base] = 100; // base0
  obj[base + 1] = 0x3f | 0x40; // code 0x3f, flipx set, flipy clear
  obj[base + 2] = 0x05; // color 5
  obj[base + 3] = 10; // x
  const a = spriteAttrs(obj, 0);
  assert.equal(a.sy, (240 - (100 - 1)) & 0xff, "sprite 0 (n<3) matches y-1");
  assert.equal(a.code, 0x3f);
  assert.equal(a.color, 5);
  assert.equal(a.flipx, true);
  assert.equal(a.flipy, false);
  assert.equal(a.sx, 11, "x + hoffset(1)");
  // sprite 3 (n>=3) has NO -1 adjust.
  const b3 = SPRITE_BASE + 3 * 4;
  obj[b3] = 100;
  assert.equal(spriteAttrs(obj, 3).sy, (240 - 100) & 0xff, "sprite 3 (n>=3) matches y");
});

/* ------------------------------------------------------------------------ background (stub) */

test("background is black in the skeleton (starfield stubbed); an empty machine renders all-black", () => {
  const mem = { videoRam: new Uint8Array(0x400), objRam: new Uint8Array(0x100) };
  // objRam all zero: tile codes 0 (pen 0 transparent), sprites off-screen-ish; palette pen 0.
  const gfx = { tiles: new Uint8Array(256 * 64), sprites: new Uint8Array(64 * 256), palette: new Uint8Array(PALETTE_SIZE * 3) };
  const out = new Uint8Array(SCREEN_W * SCREEN_H * 3);
  renderRowsRGB(out, 0, SCREEN_H - 1, mem, gfx);
  assert.ok(out.every((b) => b === 0), "black background + transparent/blank tiles -> all-black frame");
});
