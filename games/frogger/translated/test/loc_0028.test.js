// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter + mutation test for loc_0028 (rst 0x28 = copy a tilemap column up, ROM 0x0028-0x0034):
// copies B bytes up at -0x20 stride (L underflow borrows into H). Cycle totals 245 (4 bytes, no
// borrow) and 124 (2 bytes, one borrow).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0028 } from "../loc_0028.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  return m;
}

function runPlain(fn) {
  const m = mk();
  m.regs.b = 0x04; m.regs.de = 0x8100; m.regs.hl = 0xa8c5;
  m.mem.workRam[0x0100] = 0x11; m.mem.workRam[0x0101] = 0x22;
  m.mem.workRam[0x0102] = 0x33; m.mem.workRam[0x0103] = 0x44;
  const c0 = m.cycles;
  fn(m);
  return {
    cycles: m.cycles - c0, hl: m.regs.hl, de: m.regs.de, b: m.regs.b,
    v: [m.mem.videoRam[0x0c5], m.mem.videoRam[0x0a5], m.mem.videoRam[0x085], m.mem.videoRam[0x065]],
  };
}

function checkPlain(res) {
  assert.equal(res.cycles, 245, "T-state total, 4 bytes, no borrow");
  assert.deepEqual(res.v, [0x11, 0x22, 0x33, 0x44], "bytes written UP the column at -0x20 stride");
  assert.equal(res.hl, 0xa845, "HL ends at last dest - 0x20");
  assert.equal(res.de, 0x8104, "DE advanced past the 4 source bytes");
  assert.equal(res.b, 0, "B counted down to 0");
}

test("loc_0028: copy 4 bytes up a column (-0x20 stride); 245 T", () => {
  checkPlain(runPlain(loc_0028));
});

test("loc_0028: the L-underflow borrow decrements H; 124 T", () => {
  const m = mk();
  m.regs.b = 0x02; m.regs.de = 0x8100; m.regs.hl = 0xaa10;
  m.mem.workRam[0x0100] = 0x55; m.mem.workRam[0x0101] = 0x66;
  const c0 = m.cycles;
  loc_0028(m);
  assert.equal(m.cycles - c0, 124, "T-state total, one borrow");
  assert.equal(m.regs.h, 0xa9, "H decremented once on the L underflow");
  assert.equal(m.mem.videoRam[0x210], 0x55, "first byte at 0xAA10");
  assert.equal(m.mem.videoRam[0x1f0], 0x66, "second byte at 0xA9F0 (after borrow)");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0028.js
//   find: regs.sub(0x20);
//   repl: regs.sub(0x1f);
//   expect: FAIL  (wrong column stride -> bytes land at the wrong tilemap rows,
//                  caught by the VRAM-content assertion)
//   verified-anchor: count == 1  (the sole `sub 0x20` in loc_0028.js)
test("loc_0028: the contract catches a wrong column stride", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    for (;;) {
      regs.a = mem.read8(regs.de); m.step(0x0029, 7);
      mem.write8(regs.hl, regs.a); m.step(0x002a, 7);
      regs.a = regs.l; m.step(0x002b, 4);
      regs.sub(0x1f); m.step(0x002d, 7); // MUTANT: 0x1f not 0x20
      regs.l = regs.a; m.step(0x002e, 4);
      if (regs.fNC) { m.step(0x0031, 12); }
      else { m.step(0x0030, 7); regs.h = regs.dec8(regs.h); m.step(0x0031, 4); }
      regs.de = (regs.de + 1) & 0xffff; m.step(0x0032, 6);
      if (m.regs.djnz() !== 0) { m.step(0x0028, 13); continue; }
      m.step(0x0034, 8); break;
    }
    m.ret();
  };
  assert.throws(() => checkPlain(runPlain(mutant)));
});
