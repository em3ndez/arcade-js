// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0292 (Frogger NMI tail, ROM 0x0292-0x02A2): count the word at (0x829D) down;
// at zero store 0 into (0x83AE). Three contracts: (0x829D)==0 rets immediately (35 T, no write);
// (0x829D)>1 decrements and rets nz (no (0x83AE) write); (0x829D)==1 decrements to 0 and clears
// (0x83AE) (87 T).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0292 } from "../loc_0292.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const w16 = (m, a, v) => { m.mem.workRam[a - 0x8000] = v & 0xff; m.mem.workRam[a - 0x8000 + 1] = (v >> 8) & 0xff; };

test("loc_0292: (0x829D)==0 rets immediately; 35 T, no write", () => {
  const m = mk();
  m.mem.workRam[0x3ae] = 0x55;
  loc_0292(m);
  assert.equal(m.cycles, 35, "ld hl,(nn)16 + ld a,h 4 + or l 4 + ret z 11");
  assert.equal(r(m, 0x83ae), 0x55, "(0x83ae) untouched");
  assert.equal(m.pc, 0xbeef, "ret to caller");
});

function checkC(m) {
  assert.equal(r(m, 0x829d), 0x00, "(0x829d) decremented 1 -> 0");
  assert.equal(r(m, 0x83ae), 0x00, "(0x83ae) cleared on reaching zero");
  assert.equal(m.cycles, 87, "full path T total");
}

test("loc_0292: (0x829D)==1 decrements to 0 and clears (0x83AE); 87 T", () => {
  const m = mk();
  w16(m, 0x829d, 0x0001); m.mem.workRam[0x3ae] = 0x55;
  loc_0292(m);
  checkC(m);
});

test("loc_0292: (0x829D)==3 decrements and rets nz, leaving (0x83AE)", () => {
  const m = mk();
  w16(m, 0x829d, 0x0003); m.mem.workRam[0x3ae] = 0x55;
  loc_0292(m);
  assert.equal(r(m, 0x829d), 0x02, "3 -> 2");
  assert.equal(r(m, 0x83ae), 0x55, "not zero yet, (0x83ae) untouched");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0292.js
//   find: mem.write8(0x83ae, regs.a);
//   repl: mem.write8(0x83af, regs.a);
//   expect: FAIL  (clears the wrong cell; (0x83ae) stays 0x55 -- caught by checkC)
//   verified-anchor: count == 1  (the sole (0x83ae) store in loc_0292.js)
test("loc_0292: the contract catches a wrong clear address", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.hl = mem.read16(0x829d); m.step(0x0295, 16);
    regs.a = regs.h; m.step(0x0296, 4);
    regs.or(regs.l); m.step(0x0297, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x0298, 5);
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x0299, 6);
    mem.write16(0x829d, regs.hl); m.step(0x029c, 16);
    regs.a = regs.h; m.step(0x029d, 4);
    regs.or(regs.l); m.step(0x029e, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x029f, 5);
    mem.write8(0x83af, regs.a); m.step(0x02a2, 13); // MUTANT: wrong cell
    m.ret();
  };
  const m = mk();
  w16(m, 0x829d, 0x0001); m.mem.workRam[0x3ae] = 0x55;
  mutant(m);
  assert.throws(() => checkC(m));
});
