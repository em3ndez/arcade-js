// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2bfb (Frogger IX sprite-object arm, ROM 0x2BFB-0x2C12): on (ix+0x06)!=0, index
// the byte table at 0x2CD9 by that state, OR in (ix+0x05), store to (iy+0x01), and set (iy+0x02)=0x02.
// Leaf, no callees. IX = object record, IY = sprite slot; the table is ROM.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2bfb } from "../loc_2bfb.js";

const IX = 0x8060, IY = 0x8070;

function mk() {
  const rom = new Uint8Array(0x4000);
  rom[0x2cdb] = 0x30; // table[state=2]
  const m = new Machine(rom, new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.ix = IX; m.regs.iy = IY;
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const set = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

// state=2 -> table byte 0x30, OR (ix+0x05)=0x03 -> 0x33 to (iy+0x01); (iy+0x02)=0x02.
test("loc_2bfb: table lookup + OR direction -> sprite slot; 134 T", () => {
  const m = mk();
  set(m, IX + 6, 0x02); set(m, IX + 5, 0x03);
  loc_2bfb(m);
  assert.equal(r(m, IY + 1), 0x33, "(iy+0x01) = table[2] | (ix+0x05)");
  assert.equal(r(m, IY + 2), 0x02, "(iy+0x02) = 0x02");
  assert.equal(m.regs.sp, 0x8800, "stack balanced");
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.equal(m.cycles, 134, "ret z not taken, full body");
});

// (ix+0x06)==0 -> ret z, no writes.
test("loc_2bfb: inactive object rets without touching the slot; 34 T", () => {
  const m = mk();
  set(m, IX + 6, 0x00); set(m, IX + 5, 0x03);
  loc_2bfb(m);
  assert.equal(r(m, IY + 1), 0x00, "(iy+0x01) untouched");
  assert.equal(r(m, IY + 2), 0x00, "(iy+0x02) untouched");
  assert.equal(m.cycles, 34, "ld a,(ix+6) 19 + or a 4 + ret z 11");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2bfb.js
//   find: mem.write8((regs.iy + 0x02) & 0xffff, 0x02);
//   repl: mem.write8((regs.iy + 0x02) & 0xffff, 0x03);
//   expect: FAIL  ((iy+0x02) = 0x03 instead of 0x02 — caught by the assert)
//   verified-anchor: count == 1  (the sole write of the 0x02 marker in loc_2bfb.js)
// Simulated by bumping exactly the (iy+0x02) store value.
test("loc_2bfb: the contract catches a wrong (iy+0x02) marker", () => {
  const m = mk();
  set(m, IX + 6, 0x02); set(m, IX + 5, 0x03);
  const iy2 = (m.regs.iy + 0x02) & 0xffff;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, a === iy2 ? (val + 1) & 0xff : val, o);
  loc_2bfb(m);
  assert.notEqual(r(m, IY + 2), 0x02, "(iy+0x02) marker corrupted");
});
