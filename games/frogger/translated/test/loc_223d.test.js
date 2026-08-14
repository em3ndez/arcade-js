// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_223d (Frogger lane-parameter load, ROM 0x223D-0x225F): under EXX, read the
// player's difficulty index ((0x8293)/(0x8294)), look up a pointer in the 5-entry table at 0x2260, and
// LDIR 0x21 bytes of that block into 0x8270. The pointer table + block are supplied in a crafted ROM;
// EXX must restore the caller's BC/DE/HL.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_223d } from "../loc_223d.js";

function mk() {
  const rom = new Uint8Array(0x4000);
  rom[0x2260] = 0x00; rom[0x2261] = 0x30;              // table[0] -> 0x3000
  for (let k = 0; k <= 0x20; k++) rom[0x3000 + k] = 0xa0 + k; // 0x21-byte block
  const m = new Machine(rom, new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.mem.workRam[0x3fd] = 0x01; // player 1 -> (0x8293)
  m.mem.workRam[0x293] = 0x00; // difficulty index 0
  m.regs.hl = 0x1234; m.regs.bc = 0x5678; m.regs.de = 0x9abc;
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

function check(m) {
  assert.equal(r(m, 0x8270), 0xa0, "block byte 0 -> 0x8270");
  assert.equal(r(m, 0x8290), 0xc0, "block byte 0x20 -> 0x8290");
  assert.equal(m.regs.hl, 0x1234, "EXX restored caller HL");
  assert.equal(m.regs.bc, 0x5678, "EXX restored caller BC");
  assert.equal(m.regs.de, 0x9abc, "EXX restored caller DE");
}

test("loc_223d: loads the difficulty-0 lane block into 0x8270, restores caller regs", () => {
  const m = mk();
  loc_223d(m);
  check(m);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_223d.js
//   find: regs.de = 0x8270;
//   repl: regs.de = 0x8271;
//   expect: FAIL  (block lands one byte high; (0x8270) stays 0 — caught by check)
//   verified-anchor: count == 1  (the sole ld de,0x8270 in loc_223d.js)
test("loc_223d: the contract catches a wrong copy destination", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, a === 0x8270 ? (v ^ 0xff) : v, o);
  loc_223d(m);
  assert.throws(() => check(m));
});
