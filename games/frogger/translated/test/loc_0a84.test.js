// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0a84 (Frogger sorted-insert helper, ROM 0x0A84-0x0AB9): walk B=5 two-byte slots
// from 0x83F2 comparing D against each key. If D is below every key, walk all 5 and ret A=0 (no write);
// otherwise LDDR the tail down to open a gap and store (D,E). Verified with a first-slot insertion.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0a84 } from "../loc_0a84.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_0a84: D below every key walks all 5 slots and rets A=0; 246 T", () => {
  const m = mk();
  for (const a of [0x3f2, 0x3f4, 0x3f6, 0x3f8, 0x3fa]) m.mem.workRam[a] = 0xff;
  m.regs.d = 0x00; m.regs.e = 0x11;
  loc_0a84(m);
  assert.equal(m.regs.a, 0x00, "no slot found");
  for (const a of [0x3f2, 0x3f4, 0x3f6, 0x3f8, 0x3fa]) assert.equal(m.mem.workRam[a], 0xff, "table untouched");
  assert.equal(m.cycles, 246, "ld b/ld hl 17 + 4*44 + last 39 + xor a/ret 14");
});

function seed(m) {
  m.mem.workRam[0x3f1] = 0x00; m.mem.workRam[0x3f2] = 0x05; m.mem.workRam[0x3f3] = 0x11;
  m.mem.workRam[0x3f4] = 0x22; m.mem.workRam[0x3f5] = 0x33; m.mem.workRam[0x3f6] = 0x44;
  m.mem.workRam[0x3f7] = 0x55; m.mem.workRam[0x3f8] = 0x66;
  m.regs.d = 0x20; m.regs.e = 0x34;
}
function checkInsert(m) {
  assert.equal(r(m, 0x83f2), 0x20, "new key high byte D stored at head");
  assert.equal(r(m, 0x83f1), 0x34, "new key low byte E stored below it");
  assert.equal(r(m, 0x83f4), 0x05, "old (0x83f2)=0x05 shifted up two");
  assert.equal(r(m, 0x83fa), 0x66, "old (0x83f8)=0x66 shifted to the tail");
  assert.equal(m.regs.a, 0x11, "A = 2*slot + 1 (slot 0 -> 0x11)");
}

test("loc_0a84: D above the head inserts (D,E) and shifts the tail down", () => {
  const m = mk();
  seed(m);
  loc_0a84(m);
  checkInsert(m);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0a84.js
//   find: mem.write8(regs.hl, regs.d);   // block_0aa2, store the new key high byte
//   repl: mem.write8(regs.hl, regs.d ^ 0xff);
//   expect: FAIL  ((0x83f2) corrupted — caught by checkInsert)
//   verified-anchor: count == 1  (the sole (hl)<-D store in loc_0a84.js; the only write to 0x83f2)
// Simulated by corrupting exactly the 0x83f2 store, which is what the edit produces.
test("loc_0a84: the contract catches a corrupted key store", () => {
  const m = mk();
  seed(m);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, a === 0x83f2 ? (v ^ 0xff) : v, o);
  loc_0a84(m);
  assert.throws(() => checkInsert(m));
});
