// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_07d9 (Frogger game-start timer-block clear, ROM 0x07D9-0x07E5): seed
// (0x8300)=0 then LDIR-clear 0x8300-0x832F. Contract: 48 bytes zeroed, 1029 T.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_07d9 } from "../loc_07d9.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  for (let a = 0x300; a <= 0x32f; a++) m.mem.workRam[a] = 0xff;
  return m;
}

function check(m) {
  for (let a = 0x300; a <= 0x32f; a++) assert.equal(m.mem.workRam[a], 0x00, `0x8${a.toString(16)} cleared`);
  assert.equal(m.mem.workRam[0x330], 0x00, "0x8330 (beyond the block) untouched — power-on 0");
  assert.equal(m.cycles, 1029, "setup 30 + ld(hl),b 7 + ldir(46*21+16) 982 + ret 10");
}

test("loc_07d9: clears the 0x30-byte timer block 0x8300-0x832F; 1029 T", () => {
  const m = mk();
  m.mem.workRam[0x330] = 0x00;
  loc_07d9(m);
  check(m);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_07d9.js
//   find: regs.bc = 0x002f;
//   repl: regs.bc = 0x002e;
//   expect: FAIL  (clears one byte fewer; 0x832f stays 0xff — caught by check)
//   verified-anchor: count == 1  (the sole ld bc in loc_07d9.js)
test("loc_07d9: the contract catches a short clear count", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.hl = 0x8300; m.step(0x07dc, 10);
    regs.de = 0x8301; m.step(0x07df, 10);
    regs.bc = 0x002e; m.step(0x07e2, 10); // MUTANT: one byte short
    mem.write8(regs.hl, regs.b); m.step(0x07e3, 7);
    m.ldirAt(0x07e3, 0x07e5);
    m.ret();
  };
  const m = mk();
  mutant(m);
  assert.throws(() => check(m));
});
