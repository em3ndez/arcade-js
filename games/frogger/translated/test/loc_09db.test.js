// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_09db (Frogger home-marker render, ROM 0x09DB-0x0A15): walk the 5-byte occupancy
// list at (HL); each non-zero slot stamps 4 tiles (0x6C,0x6D and, one row +0x1F below, 0x6E,0x6F) at that
// slot's fixed VRAM base. Slots 0-3 enter the stamp via `call nz`; slot 4 falls through it (its `ret`
// exits the routine). Verifies the stamped tiles, the untouched slots, and the exact T-state totals.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_09db } from "../loc_09db.js";

const LIST = 0x8263; // where loc_09d2 points HL before calling
const BASES = [0xab64, 0xaaa4, 0xa9e4, 0xa924, 0xa864]; // per-slot VRAM base, -0xC0 each

function mk(list) {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  for (let i = 0; i < list.length; i++) m.mem.workRam[LIST - 0x8000 + i] = list[i];
  m.regs.hl = LIST;
  return m;
}
const tiles = (m, base) => [m.mem.read8(base), m.mem.read8(base + 1), m.mem.read8(base + 0x20), m.mem.read8(base + 0x21)];
const STAMP = [0x6c, 0x6d, 0x6e, 0x6f];

test("loc_09db: slots 0,2,4 occupied -> three stamps, others clear; 461 T", () => {
  const m = mk([1, 0, 1, 0, 1]);
  loc_09db(m);
  for (const s of [0, 2, 4]) assert.deepEqual(tiles(m, BASES[s]), STAMP, `slot ${s} stamped`);
  for (const s of [1, 3]) assert.deepEqual(tiles(m, BASES[s]), [0, 0, 0, 0], `slot ${s} clear`);
  assert.equal(m.regs.hl, LIST + 4, "HL walked to the last slot");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  // 2 occupied via call (135 each) + 2 empty (37 each) + slot4 fall-through (117)
  assert.equal(m.cycles, 461, "135+37+135+37+117");
});

test("loc_09db: all slots empty -> no stamps, ret z at slot 4; 180 T", () => {
  const m = mk([0, 0, 0, 0, 0]);
  loc_09db(m);
  for (const b of BASES) assert.deepEqual(tiles(m, b), [0, 0, 0, 0], "untouched");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.equal(m.cycles, 180, "4*37 (empty slots) + 32 (ret z taken at slot 4)");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_09db.js
//   find: mem.write8(regs.hl, 0x6c);
//   repl: mem.write8(regs.hl, 0x6c ^ 0xff);
//   expect: FAIL  (every stamped slot's first tile is wrong -- caught by the STAMP deepEqual)
//   verified-anchor: count == 1  (the sole 0x6c store in loc_09db.js, the top-left home tile)
// Simulated by corrupting exactly the byte written with value 0x6c, which is what the edit produces.
test("loc_09db: the contract catches a corrupted top-left home tile", () => {
  const m = mk([1, 0, 1, 0, 1]);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, v === 0x6c ? (v ^ 0xff) : v, o);
  loc_09db(m);
  assert.throws(() => {
    for (const s of [0, 2, 4]) assert.deepEqual(tiles(m, BASES[s]), STAMP);
  });
});
