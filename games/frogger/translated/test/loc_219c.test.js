// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_219c (Frogger column-N scroll-wrap handler, ROM 0x219C-0x2230). With the IX
// descriptor at 0x827C = {col 0, units 1, rows 2} the band base computes to 0xA82E; the folded copy
// helper blits the mode-selected source row (0x2231/0x2235/0x2239) down the band three times, one row
// pair per band. The tail stores rows-1 to (0x8119). Source rows are crafted in ROM.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_219c } from "../loc_219c.js";

const DEST = 0xa82e; // band base for {col 0, units 1, rows 2}; (rows-1)*0x20 + col + 0xa80e

function mk(mode, latch = 0) {
  const rom = new Uint8Array(0x4000);
  rom.set([0x94, 0x95, 0x96, 0x97], 0x2231); // source row A (mode 0x00 / 0x70)
  rom.set([0x81, 0x82, 0x83, 0x84], 0x2235); // source row B (mode 0x30 / 0x60)
  rom.set([0xa0, 0xa1, 0xa2, 0xa3], 0x2239); // source row C (mode 0x50)
  const m = new Machine(rom, new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.mem.workRam[0x27c] = 0x00; // (ix+0) column
  m.mem.workRam[0x27d] = 0x01; // (ix+1) unit count
  m.mem.workRam[0x27e] = 0x02; // (ix+2) row count
  m.mem.workRam[0x111] = mode; // (0x8111) scroll-phase mode
  m.mem.workRam[0x108] = latch; // (0x8108) wrap-latch
  return m;
}

const V = (m, a) => m.mem.videoRam[a & 0x3ff];

function expectBand(m, src) {
  for (let b = 0; b < 3; b++) {
    const base = (DEST + b * 0x40) & 0xffff;
    assert.equal(V(m, base), src[0], `band ${b} col0 hi`);
    assert.equal(V(m, base + 1), src[1], `band ${b} col1 hi`);
    assert.equal(V(m, (base + 0x20) & 0xffff), src[2], `band ${b} col0 lo`);
    assert.equal(V(m, (base + 0x21) & 0xffff), src[3], `band ${b} col1 lo`);
  }
}

test("loc_219c: mode 0x00 blits source row A down three bands; (0x8119)=rows-1", () => {
  const m = mk(0x00);
  loc_219c(m);
  expectBand(m, [0x94, 0x95, 0x96, 0x97]);
  assert.equal(m.mem.workRam[0x119], 0x01, "(0x8119) = rows - 1");
  assert.equal(m.regs.sp, 0x8800, "SP balanced across the three folded calls");
  assert.equal(m.pc, 0xbeef, "final ret returns to the caller sentinel");
});

test("loc_219c: mode 0x50 blits source row C and SETS the wrap-latch (0x8108)=1", () => {
  const m = mk(0x50);
  loc_219c(m);
  expectBand(m, [0xa0, 0xa1, 0xa2, 0xa3]);
  assert.equal(m.mem.workRam[0x108], 0x01, "(0x8108) set");
});

test("loc_219c: mode 0x30 blits source row B and CLEARS a nonzero wrap-latch", () => {
  const m = mk(0x30, 0x05);
  loc_219c(m);
  expectBand(m, [0x81, 0x82, 0x83, 0x84]);
  assert.equal(m.mem.workRam[0x108], 0x00, "(0x8108) cleared");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_219c.js
//   find: regs.de = 0xa80e;
//   repl: regs.de = 0xa80f;   // wrong video-RAM band base (off by one column)
//   expect: FAIL  (every copied tile lands one column right; the band check reads the true offsets)
//   verified-anchor: count == 1  (the sole regs.de = 0xa80e in loc_219c.js)
test("loc_219c: a one-column band-base error is caught", () => {
  const m = mk(0x00);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a >= 0xa800 && a <= 0xabff ? (a + 1) & 0xffff : a, val, o);
  loc_219c(m);
  assert.throws(() => expectBand(m, [0x94, 0x95, 0x96, 0x97]), "the band-offset check has teeth");
});
