// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0faf (Frogger frog-animation dispatcher, ROM 0x0FAF-0x0FBD): index = low byte
// of (0x8000); HL = 0x0FBE + 2*index reads a 16-bit pointer from the table at 0x0FBE and `jp (hl)`
// enters that arm. The pointer table is supplied in a crafted ROM; arms are stubbed.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0faf } from "../loc_0faf.js";

const ARMS = [0x0fd4, 0x1058, 0x107b, 0x109b, 0x10bb, 0x10db, 0x10f8, 0x1118, 0x1138, 0x1158, 0x1178];

function mkRom() {
  const rom = new Uint8Array(0x4000);
  ARMS.forEach((a, i) => { rom[0x0fbe + 2 * i] = a & 0xff; rom[0x0fbe + 2 * i + 1] = (a >> 8) & 0xff; });
  return rom;
}

function mk(index) {
  const routines = new Map();
  for (const a of ARMS) routines.set(a, () => {}); // arm bodies are a later batch
  const m = new Machine(mkRom(), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.mem.workRam[0x000] = index; // (0x8000) low byte = the index
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}

test("loc_0faf: index 0 delegates to arm 0x0FD4; 83 T", () => {
  const m = mk(0);
  loc_0faf(m);
  assert.deepEqual(m.calls, [0x0fd4], "jp (hl) -> table[0]");
  assert.equal(m.cycles, 83, "dispatch stub T total (jp(hl) included, arm stub 0)");
});

test("loc_0faf: index 5 delegates to arm 0x10DB", () => {
  const m = mk(5);
  loc_0faf(m);
  assert.deepEqual(m.calls, [0x10db], "jp (hl) -> table[5]");
});

test("loc_0faf: index 10 delegates to the last arm 0x1178", () => {
  const m = mk(10);
  loc_0faf(m);
  assert.deepEqual(m.calls, [0x1178], "jp (hl) -> table[10]");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0faf.js
//   find: regs.bc = 0x0fbe;
//   repl: regs.bc = 0x0fbf;   // wrong pointer-table base
//   expect: FAIL  (reads a misaligned pointer -> out-of-table target -> the switch default throws)
//   verified-anchor: count == 1  (the sole ld bc,0x0fbe in loc_0faf.js)
test("loc_0faf: a wrong table base yields an out-of-table target the guard rejects", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.hl = mem.read16(0x8000); m.step(0x0fb2, 16);
    regs.bc = 0x0fbf; m.step(0x0fb5, 10); // MUTANT: base off by one
    regs.h = 0x00; m.step(0x0fb7, 7);
    regs.addHl(regs.hl); m.step(0x0fb8, 11);
    regs.addHl(regs.bc); m.step(0x0fb9, 11);
    regs.c = mem.read8(regs.hl); m.step(0x0fba, 7);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0fbb, 6);
    regs.h = mem.read8(regs.hl); m.step(0x0fbc, 7);
    regs.l = regs.c; m.step(0x0fbd, 4);
    m.step(regs.hl, 4);
    if (!ARMS.includes(regs.hl)) throw new Error(`jp(hl) 0x${regs.hl.toString(16)} outside the table`);
    return m.call(regs.hl);
  };
  const m = mk(0);
  assert.throws(() => mutant(m), /outside the table/);
});
