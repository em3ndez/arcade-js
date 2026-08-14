// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_09aa (Frogger frog-object RESET, ROM 0x09AA-0x09C9): write the 0x8044
// object block (0x80,0x1e,0x03,0xe0), clear 0x83cd/0x842d/0x842c/0x8269, set 0x83c3=1. PURE
// LEAF; unconditional straight-line path totals 145 T through the ret.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_09aa } from "../loc_09aa.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  // Pre-dirty every touched cell so a missing write is caught, not masked by an initial 0.
  for (const a of [0x044, 0x045, 0x046, 0x047, 0x3cd, 0x42d, 0x42c, 0x269, 0x3c3]) {
    m.mem.workRam[a] = 0xff;
  }
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

function checkState(m) {
  assert.equal(r(m, 0x8044), 0x80, "(0x8044) = 0x80 (object X)");
  assert.equal(r(m, 0x8045), 0x1e, "(0x8045) = 0x1e (object Y)");
  assert.equal(r(m, 0x8046), 0x03, "(0x8046) = 0x03");
  assert.equal(r(m, 0x8047), 0xe0, "(0x8047) = 0xe0");
  assert.equal(r(m, 0x83cd), 0x00, "(0x83cd) = 0");
  assert.equal(r(m, 0x842d), 0x00, "(0x842d) = 0");
  assert.equal(r(m, 0x842c), 0x00, "(0x842c) = 0");
  assert.equal(r(m, 0x8269), 0x00, "(0x8269) = 0");
  assert.equal(r(m, 0x83c3), 0x01, "(0x83c3) = 1");
}

test("loc_09aa: writes the object block, clears four cells, sets 0x83c3; 145 T", () => {
  const m = mk();
  loc_09aa(m);
  checkState(m);
  assert.equal(m.pc, 0xbeef, "returns to caller (popped 0xbeef)");
  assert.equal(m.cycles, 145, "straight-line total through ret");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_09aa.js
//   find: mem.write8(0x83c3, regs.a);
//   repl: mem.write8(0x83c3, 0x00);
//   expect: FAIL  ((0x83c3) = 0 instead of 1 — caught by checkState)
//   verified-anchor: count == 1  (the sole store to 0x83c3 in loc_09aa.js)
test("loc_09aa: the contract catches a wrong 0x83c3 set-byte", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.hl = 0x8044; m.step(0x09ad, 10);
    mem.write8(regs.hl, 0x80); m.step(0x09af, 10);
    regs.l = regs.inc8(regs.l); m.step(0x09b0, 4);
    mem.write8(regs.hl, 0x1e); m.step(0x09b2, 10);
    regs.l = regs.inc8(regs.l); m.step(0x09b3, 4);
    mem.write8(regs.hl, 0x03); m.step(0x09b5, 10);
    regs.l = regs.inc8(regs.l); m.step(0x09b6, 4);
    mem.write8(regs.hl, 0xe0); m.step(0x09b8, 10);
    regs.xor(regs.a); m.step(0x09b9, 4);
    mem.write8(0x83cd, regs.a); m.step(0x09bc, 13);
    mem.write8(0x842d, regs.a); m.step(0x09bf, 13);
    mem.write8(0x842c, regs.a); m.step(0x09c2, 13);
    mem.write8(0x8269, regs.a); m.step(0x09c5, 13);
    regs.a = regs.inc8(regs.a); m.step(0x09c6, 4);
    mem.write8(0x83c3, 0x00); m.step(0x09c9, 13); // MUTANT
    m.ret();
  };
  const m = mk();
  mutant(m);
  assert.throws(() => checkState(m));
});
