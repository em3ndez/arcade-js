// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2970 (Frogger IX sprite-object cluster entry, ROM 0x2970-0x29B8). It writes no
// RAM itself: its contract is WHICH sub-dispatcher it CALLs (0x29B9 / 0x2B83) and the IX/IY descriptor
// each sees. (0x83B7) gates the slot count, (0x83FD) picks the IX pair. Sub-dispatchers are SP-balancer
// stubs; a call wrapper records {addr, ix, iy} at entry.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2970 } from "../loc_2970.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk(slotCount, ixSel) {
  const routines = new Map([[0x29b9, bal], [0x2b83, bal]]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.mem.workRam[0x3b7] = slotCount; // (0x83b7)
  m.mem.workRam[0x3fd] = ixSel; // (0x83fd)
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push({ addr: a, ix: m.regs.ix, iy: m.regs.iy }); return oc(a, ...r); };
  return m;
}

test("loc_2970: count<3 runs only the 0x2b83 pass (IX 0x8480, IY 0x8058); 123 T", () => {
  const m = mk(0, 1);
  loc_2970(m);
  assert.deepEqual(m.calls, [{ addr: 0x2b83, ix: 0x8480, iy: 0x8058 }]);
  assert.equal(m.cycles, 123, "the <3 fast path");
  assert.equal(m.regs.sp, 0x8800, "SP balanced");
});

test("loc_2970: 3<=count<6 runs 0x29b9 twice with the SAME IX/IY (overlap arm), then 0x2b83", () => {
  const m = mk(3, 1); // (0x83fd)=1 -> first IX pair 0x8440
  loc_2970(m);
  assert.deepEqual(m.calls, [
    { addr: 0x29b9, ix: 0x8440, iy: 0x8048 },
    { addr: 0x29b9, ix: 0x8440, iy: 0x8048 }, // overlap arm leaves IX/IY unchanged
    { addr: 0x2b83, ix: 0x8480, iy: 0x8058 },
  ]);
});

test("loc_2970: count>=6 advances IX by 0x10 and IY to 0x8050 for the 2nd 0x29b9 pass", () => {
  const m = mk(6, 2); // (0x83fd)!=1 -> IX pair 0x8460 / 0x8490
  loc_2970(m);
  assert.deepEqual(m.calls, [
    { addr: 0x29b9, ix: 0x8460, iy: 0x8048 },
    { addr: 0x29b9, ix: 0x8470, iy: 0x8050 },
    { addr: 0x2b83, ix: 0x8490, iy: 0x8058 },
  ]);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2970.js
//   find: regs.de = 0x0010;
//   repl: regs.de = 0x0011;   // wrong IX advance before the 2nd sub-dispatch
//   expect: FAIL  (the 2nd 0x29b9 pass sees IX 0x8471 instead of 0x8470)
//   verified-anchor: count == 1  (the sole regs.de = 0x0010 in loc_2970.js)
test("loc_2970: a wrong 2nd-pass IX advance is caught (count>=6 path)", () => {
  const m = mk(6, 2);
  const mutant = (mm) => {
    const { regs, mem } = mm;
    regs.a = mem.read8(0x83b7); mm.step(0x2973, 13);
    regs.cp(0x03); mm.step(0x2975, 7);
    mm.step(0x2977, 7);
    regs.a = mem.read8(0x83fd); mm.step(0x297a, 13);
    regs.a = regs.dec8(regs.a); mm.step(0x297b, 4);
    mm.step(0x2983, 12);
    regs.ix = 0x8460; mm.step(0x2987, 14);
    regs.iy = 0x8048; mm.step(0x298b, 14);
    mm.push16(0x298e); mm.step(0x29b9, 17); mm.call(0x29b9);
    regs.a = mem.read8(0x83b7); mm.step(0x2991, 13);
    regs.cp(0x06); mm.step(0x2993, 7);
    mm.step(0x2995, 7);
    regs.de = 0x0011; mm.step(0x2998, 10); // MUTANT: 0x0010 -> 0x0011
    regs.addIx(regs.de); mm.step(0x299a, 15);
    regs.iy = 0x8050; mm.step(0x299e, 14);
    mm.push16(0x29a1); mm.step(0x29b9, 17); mm.call(0x29b9);
    regs.a = mem.read8(0x83fd); mm.step(0x29a4, 13);
    regs.a = regs.dec8(regs.a); mm.step(0x29a5, 4);
    mm.step(0x29ad, 12);
    regs.ix = 0x8490; mm.step(0x29b1, 14);
    regs.iy = 0x8058; mm.step(0x29b5, 14);
    mm.push16(0x29b8); mm.step(0x2b83, 17); mm.call(0x2b83);
    mm.ret();
  };
  mutant(m);
  assert.throws(() => assert.equal(m.calls[1].ix, 0x8470), "the 2nd-pass IX check has teeth");
});
