// SPDX-License-Identifier: GPL-3.0-only
/**
 * Space Invaders video tests (no ROM: synthetic main_ram, exact-RGB decode). Grounds the 1bpp
 * framebuffer addressing + bit order against invaders_state::screen_update_invaders in
 * mame-src/src/mame/midw8080/mw8080bw_v.cpp (lines 356-407): offs = (y<<5)|(x>>3); the byte is
 * shifted right one bit per pixel (video_data>>1) with (video_data & 0x01) plotted first, so the
 * LSB is the leftmost pixel; set bit -> rgb_t::white(), clear -> rgb_t::black(). Pre-rotation
 * 256x224 frame; ROT270 (mw8080bw.cpp:2724) is display-only and NOT asserted here.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { renderFrame, SCREEN_W, SCREEN_H, FB_OFFSET, BYTES_PER_ROW } from "../video.js";

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const RAM_SIZE = 8192; // main_ram 0x2000-0x3FFF (hardware.json stateDumpSize)

const px = (out, r, c) => { const o = (r * SCREEN_W + c) * 3; return [out[o], out[o + 1], out[o + 2]]; };

// Independent MAME-derived decode: y = VCOUNTER_START_NO_VBLANK(0x20)+row, offs=(y<<5)|(c>>3), the
// base ((0x20+row)<<5) reproduces 0x400+row*32 from the vcounter rather than copying the component.
function refPixel(ram, r, c) {
  const offs = ((0x20 + r) << 5) | (c >> 3);
  return ((ram[offs] >> (c & 7)) & 1) ? WHITE : BLACK;
}
// Plausible-wrong renderer: MSB leftmost. Used only as a positive control below.
function msbPixel(ram, r, c) {
  const offs = ((0x20 + r) << 5) | (c >> 3);
  return ((ram[offs] >> (7 - (c & 7))) & 1) ? WHITE : BLACK;
}

function randRam(seed) {
  let s = seed >>> 0;
  const r = new Uint8Array(RAM_SIZE);
  for (let i = 0; i < RAM_SIZE; i++) { s = (s * 1664525 + 1013904223) >>> 0; r[i] = (s >>> 16) & 0xff; }
  return r;
}

test("dimensions + RGB888 buffer length match the pre-rotation screen; blank RAM is all black", () => {
  assert.equal(SCREEN_W, 256);
  assert.equal(SCREEN_H, 224);
  assert.equal(FB_OFFSET, 0x400); // 0x2400 - 0x2000
  assert.equal(BYTES_PER_ROW, 32); // 256 px / 8
  const out = renderFrame(new Uint8Array(RAM_SIZE));
  assert.equal(out.length, 256 * 224 * 3);
  assert.ok(out.every((v) => v === 0), "clear framebuffer -> black");
});

test("bit order is LSB-first: byte 0x01 lights column 0, byte 0x80 lights column 7 (MSB-first fails)", () => {
  let ram = new Uint8Array(RAM_SIZE);
  ram[0x400] = 0x01; // bit0 set
  let out = renderFrame(ram);
  assert.deepEqual(px(out, 0, 0), WHITE, "bit0 -> leftmost column");
  for (let c = 1; c < 8; c++) assert.deepEqual(px(out, 0, c), BLACK, `col ${c} clear`);

  ram = new Uint8Array(RAM_SIZE);
  ram[0x400] = 0x80; // bit7 set: an MSB-first decode would wrongly light column 0
  out = renderFrame(ram);
  assert.deepEqual(px(out, 0, 7), WHITE, "bit7 -> column 7");
  assert.deepEqual(px(out, 0, 0), BLACK, "column 0 stays black (kills MSB-first)");
});

test("row stride 32 + (col>>3) addressing: a poke lands only at the MAME offs cell", () => {
  const ram = new Uint8Array(RAM_SIZE);
  ram[0x400 + 5 * 32 + 3] = 0x02; // row 5, byte-group 3, bit1 -> col 3*8+1 = 25
  const out = renderFrame(ram);
  assert.deepEqual(px(out, 5, 25), WHITE, "row 5 col 25");
  assert.deepEqual(px(out, 5, 24), BLACK, "same group, bit0 clear");
  assert.deepEqual(px(out, 5, 26), BLACK, "same group, bit2 clear");
  assert.deepEqual(px(out, 4, 25), BLACK, "row above untouched (stride 32)");
  assert.deepEqual(px(out, 6, 25), BLACK, "row below untouched");
});

test("byte-boundary neighbors: col 7 is group k bit7, col 8 is group k+1 bit0", () => {
  const ram = new Uint8Array(RAM_SIZE);
  ram[0x400] = 0x80;     // group 0, bit7 -> col 7
  ram[0x400 + 1] = 0x01; // group 1, bit0 -> col 8
  const out = renderFrame(ram);
  assert.deepEqual(px(out, 0, 6), BLACK);
  assert.deepEqual(px(out, 0, 7), WHITE, "group 0 bit7");
  assert.deepEqual(px(out, 0, 8), WHITE, "group 1 bit0");
  assert.deepEqual(px(out, 0, 9), BLACK);
});

test("full-frame decode matches an independent MAME-derived reference over random RAM", () => {
  for (const seed of [1, 7, 42]) {
    const ram = randRam(seed);
    const out = renderFrame(ram);
    const expected = new Uint8Array(SCREEN_W * SCREEN_H * 3);
    let o = 0;
    for (let r = 0; r < SCREEN_H; r++) {
      for (let c = 0; c < SCREEN_W; c++) {
        const p = refPixel(ram, r, c);
        expected[o++] = p[0]; expected[o++] = p[1]; expected[o++] = p[2];
      }
    }
    assert.deepEqual(out, expected, `seed ${seed}`);
  }
});

test("teeth: LSB-first and MSB-first references genuinely differ (positive control)", () => {
  const ram = randRam(7);
  let differs = false;
  for (let c = 0; c < 8 && !differs; c++) {
    if (refPixel(ram, 0, c)[0] !== msbPixel(ram, 0, c)[0]) differs = true;
  }
  assert.ok(differs, "the two bit orders disagree on random data, so the prior test has teeth");
});
