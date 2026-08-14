// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0c4a (Frogger VRAM helper, ROM 0x0C4A-0x0C50): write byte E at row (D-C); if
// D-C == D (i.e. C==0) skip the write. HL high byte selects the VRAM column.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0c4a } from "../loc_0c4a.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}

test("loc_0c4a: writes E at row (D-C); 38 T", () => {
  const m = mk();
  m.regs.hl = 0xa800; m.regs.d = 0x30; m.regs.c = 0x05; m.regs.e = 0x77;
  loc_0c4a(m);
  assert.equal(m.mem.videoRam[0x2b], 0x77, "HL=0xa8|(0x30-0x05=0x2b), stores E=0x77");
  assert.equal(m.cycles, 38, "ld a,d 4 + sub c 4 + cp d 4 + ret z n/t 5 + ld l,a 4 + ld(hl),e 7 + ret 10");
});

test("loc_0c4a: C==0 skips the write (D-C == D); 23 T", () => {
  const m = mk();
  m.regs.hl = 0xa800; m.regs.d = 0x30; m.regs.c = 0x00; m.regs.e = 0x77;
  loc_0c4a(m);
  assert.equal(m.mem.videoRam[0x30], 0x00, "nothing written when C==0");
  assert.equal(m.cycles, 23, "ld a,d 4 + sub c 4 + cp d 4 + ret z taken 11");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0c4a.js
//   find: mem.write8(regs.hl, regs.e);
//   repl: mem.write8(regs.hl, regs.d);
//   expect: FAIL  (stores D instead of E — caught by the value assert)
//   verified-anchor: count == 1  (the sole store in loc_0c4a.js)
test("loc_0c4a: the contract catches storing the wrong register", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.a = regs.d; m.step(0x0c4b, 4);
    regs.sub(regs.c); m.step(0x0c4c, 4);
    regs.cp(regs.d); m.step(0x0c4d, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x0c4e, 5);
    regs.l = regs.a; m.step(0x0c4f, 4);
    mem.write8(regs.hl, regs.d); m.step(0x0c50, 7); // MUTANT: stores D, not E
    m.ret();
  };
  const m = mk();
  m.regs.hl = 0xa800; m.regs.d = 0x30; m.regs.c = 0x05; m.regs.e = 0x77;
  mutant(m);
  assert.equal(m.mem.videoRam[0x2b], 0x30, "mutant wrote D");
  assert.throws(() => assert.equal(m.mem.videoRam[0x2b], 0x77));
});
