// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0b0a (Frogger game-start score reset, ROM 0x0B0A-0x0B1E): zero the score words
// (0x83E7)/(0x83EB)/(0x83ED), then set both bytes of (0x83E5) to (0x83E4). Contract: 6 words, 106 T.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0b0a } from "../loc_0b0a.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  for (const a of [0x3e7, 0x3e8, 0x3eb, 0x3ec, 0x3ed, 0x3ee]) m.mem.workRam[a] = 0xff;
  m.mem.workRam[0x3e4] = 0x42;
  return m;
}
const r16 = (m, a) => m.mem.workRam[a - 0x8000] | (m.mem.workRam[a - 0x8000 + 1] << 8);

function check(m) {
  assert.equal(r16(m, 0x83e7), 0x0000, "(0x83e7) score word cleared");
  assert.equal(r16(m, 0x83eb), 0x0000, "(0x83eb) score word cleared");
  assert.equal(r16(m, 0x83ed), 0x0000, "(0x83ed) score word cleared");
  assert.equal(r16(m, 0x83e5), 0x4242, "(0x83e5) = (0x83e4) duplicated into both bytes");
  assert.equal(m.cycles, 105, "ld hl 10 + 3x ld(nn),hl 48 + ld a 13 + ld h,a 4 + ld l,a 4 + ld(nn),hl 16 + ret 10");
}

test("loc_0b0a: clears score words and seeds (0x83E5); 105 T", () => {
  const m = mk();
  loc_0b0a(m);
  check(m);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0b0a.js
//   find: regs.l = regs.a;\n  m.step(0x0b1b, 4);
//   repl: m.step(0x0b1b, 4);   // drop `ld l,a`, leaving L = 0
//   expect: FAIL  ((0x83e5) low byte 0 instead of 0x42 — caught by check)
//   verified-anchor: count == 1  (the `ld l,a` feeding (0x83e5) in loc_0b0a.js)
test("loc_0b0a: the contract catches a dropped low-byte copy", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.hl = 0x0000; m.step(0x0b0d, 10);
    mem.write16(0x83ed, regs.hl); m.step(0x0b10, 16);
    mem.write16(0x83eb, regs.hl); m.step(0x0b13, 16);
    mem.write16(0x83e7, regs.hl); m.step(0x0b16, 16);
    regs.a = mem.read8(0x83e4); m.step(0x0b19, 13);
    regs.h = regs.a; m.step(0x0b1a, 4);
    m.step(0x0b1b, 4); // MUTANT: `ld l,a` dropped, L stays 0
    mem.write16(0x83e5, regs.hl); m.step(0x0b1e, 16);
    m.ret();
  };
  const m = mk();
  mutant(m);
  assert.throws(() => check(m));
});
