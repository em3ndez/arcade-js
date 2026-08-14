// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_14b7 (Frogger object/sprite dispatcher, ROM 0x14B7-0x14C6): index = (0x80FF);
// HL = 0x14C7 + 2*index reads a 16-bit pointer from the table at 0x14C7 and `jp (hl)` enters that arm.
// The pointer table is supplied in a crafted ROM; arms are stubbed.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_14b7 } from "../loc_14b7.js";

const ARMS = [0x14dd, 0x14ee, 0x14ff, 0x1510, 0x1521, 0x1532, 0x1543, 0x1554, 0x1565, 0x1576, 0x1587];

function mkRom() {
  const rom = new Uint8Array(0x4000);
  ARMS.forEach((a, i) => { rom[0x14c7 + 2 * i] = a & 0xff; rom[0x14c7 + 2 * i + 1] = (a >> 8) & 0xff; });
  return rom;
}

function mk(index) {
  const routines = new Map();
  for (const a of ARMS) routines.set(a, () => {});
  const m = new Machine(mkRom(), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.mem.workRam[0x0ff] = index; // (0x80ff) = the object index
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}

test("loc_14b7: index 0 delegates to arm 0x14DD; 77 T", () => {
  const m = mk(0);
  loc_14b7(m);
  assert.deepEqual(m.calls, [0x14dd], "jp (hl) -> table[0]");
  assert.equal(m.cycles, 77, "dispatch stub T total (jp(hl) included, arm stub 0)");
});

test("loc_14b7: index 6 delegates to arm 0x1543", () => {
  const m = mk(6);
  loc_14b7(m);
  assert.deepEqual(m.calls, [0x1543], "jp (hl) -> table[6]");
});

test("loc_14b7: index 10 delegates to the last arm 0x1587", () => {
  const m = mk(10);
  loc_14b7(m);
  assert.deepEqual(m.calls, [0x1587], "jp (hl) -> table[10]");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_14b7.js
//   find: regs.add(regs.a);   // add a,a -> 2*index
//   repl: (drop the doubling)
//   expect: FAIL  (index not doubled -> misaligned pointer -> out-of-table target -> guard throws)
//   verified-anchor: count == 1  (the sole add a,a in loc_14b7.js)
test("loc_14b7: without the index doubling the guard rejects the target", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x80ff); m.step(0x14ba, 13);
    regs.bc = 0x14c7; m.step(0x14bd, 10);
    regs.h = 0x00; m.step(0x14bf, 7);
    m.step(0x14c0, 4); // MUTANT: add a,a dropped (A not doubled)
    regs.l = regs.a; m.step(0x14c1, 4);
    regs.addHl(regs.bc); m.step(0x14c2, 11);
    regs.c = mem.read8(regs.hl); m.step(0x14c3, 7);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x14c4, 6);
    regs.h = mem.read8(regs.hl); m.step(0x14c5, 7);
    regs.l = regs.c; m.step(0x14c6, 4);
    m.step(regs.hl, 4);
    if (!ARMS.includes(regs.hl)) throw new Error(`jp(hl) 0x${regs.hl.toString(16)} outside the table`);
    return m.call(regs.hl);
  };
  const m = mk(3); // odd offset once un-doubled -> misaligned
  assert.throws(() => mutant(m), /outside the table/);
});
