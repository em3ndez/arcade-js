// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_085b (Frogger "no more frogs" tail, ROM 0x085B-0x086F). Blits a 4-tile strip
// (rst 0x28 from 0x2F6E) then a 5-tile strip (rst 0x28 from 0x2F12) up the column from 0xAA51, then
// sets (0x8004)=1. rst 0x28 is stubbed (SP-balanced), so the two blits are observed by their args.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_085b } from "../loc_085b.js";

function mk() {
  const blits = [];
  const bal = (mm) => {
    blits.push({ hl: mm.regs.hl, de: mm.regs.de, b: mm.regs.b });
    mm.regs.sp = (mm.regs.sp + 2) & 0xffff;
  };
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x0028, bal]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.blits = blits;
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_085b: two blits (0x2f6e x4, 0x2f12 x5) then (0x8004)=1; 96 T", () => {
  const m = mk();
  loc_085b(m);
  assert.equal(r(m, 0x8004), 0x01, "(0x8004) = 1");
  assert.deepEqual(
    m.blits,
    [
      { hl: 0xaa51, de: 0x2f6e, b: 0x04 },
      { hl: 0xaa51, de: 0x2f12, b: 0x05 },
    ],
    "two rst 0x28 blits, each with src/dst/count (HL untouched by the stub, so both read 0xaa51)",
  );
  assert.equal(m.cycles, 96, "10+10+7+11 + 10+7+11 + 7+13+10");
  assert.equal(m.pc, 0xbeef, "ret returned to the caller sentinel");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_085b.js
//   find: mem.write8(0x8004, regs.a);
//   repl: mem.write8(0x8005, regs.a);   // wrong tail-flag address
//   expect: FAIL  ((0x8004) stays 0 -- the "no more frogs" flag is never set)
//   verified-anchor: count == 1  (the sole mem.write8 in loc_085b.js)
// Simulated by redirecting the 0x8004 store to 0x8005, which is what the edit produces.
test("loc_085b: the contract catches a mis-addressed tail flag", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a === 0x8004 ? 0x8005 : a, val, o);
  loc_085b(m);
  assert.throws(() => assert.equal(r(m, 0x8004), 0x01));
});
