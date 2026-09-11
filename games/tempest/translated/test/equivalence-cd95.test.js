// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_cd95 (ROM 0xcd95) -- reset/clear of the $c0/$d0/$60c0/$60d0 slot arrays after a
// $60ca/$60da stability poll. Minimal 6502 harness, author-derived. Run:
//   node --test games/tempest/translated/test/equivalence-cd95.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_cd95 } from "../loc_cd95.js";

function makeMachine(mem) {
  const regs = new Regs();
  return {
    regs, mem, cycles: 0, pc: 0,
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

function flatMem(ram) {
  return {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
}

test("loc_cd95: stable poll (60ca/60da constant) -> arrays cleared, 60cf/60df=7, 0720=0, 328 T", () => {
  const ram = new Uint8Array(0x10000);
  const m = makeMachine(flatMem(ram));
  m.regs.s = 0xfd;
  m.push16(0x3000); // rts -> 0x3001
  ram[0x60ca] = 0x5a;
  ram[0x60da] = 0x3c;
  // dirty the regions the routine must clear
  for (let i = 0; i < 8; i++) { ram[0x60c0 + i] = 0xf1; ram[0x60d0 + i] = 0xf2; ram[0xc0 + i] = 0xf3; ram[0xd0 + i] = 0xf4; }
  ram[0x60c8] = 0xee; ram[0x60d8] = 0xee; ram[0x0720] = 0xee;
  ram[0x60c9] = 0xbb; // canary just past the abs,x=7..0 span

  loc_cd95(m);

  assert.equal(ram[0x60cf], 0x07, "60cf reloaded to 7");
  assert.equal(ram[0x60df], 0x07, "60df reloaded to 7");
  assert.equal(ram[0x0720], 0x00, "0720 stays 0 on the stable path (cdb2 never runs)");
  for (let i = 0; i < 8; i++) {
    assert.equal(ram[0x60c0 + i], 0x00, `60c0+${i} cleared`);
    assert.equal(ram[0x60d0 + i], 0x00, `60d0+${i} cleared`);
    assert.equal(ram[0xc0 + i], 0x00, `c0+${i} cleared`);
    assert.equal(ram[0xd0 + i], 0x00, `d0+${i} cleared`);
  }
  assert.equal(ram[0x60c8], 0x00, "60c8 cleared");
  assert.equal(ram[0x60d8], 0x00, "60d8 cleared");
  assert.equal(ram[0x60c9], 0xbb, "canary untouched (abs,x span is 60c0..60c7)");
  assert.equal(m.regs.a, 0x00, "A ends 0");
  assert.equal(m.regs.x, 0xff, "X ends 0xff (inner clear loop ran to bpl fail)");
  assert.equal(m.regs.y, 0x3c, "Y holds the 60da load");
  assert.equal(m.pc, 0x3001, "rts");
  assert.equal(m.cycles, 328, "prologue 24 + poll 89 + mid 14 + clear 183 + epilogue 18");
});

test("loc_cd95: unstable poll (60ca changes) -> cdb2 sta 0x0720 = A, cdb5 ldx #0 taken", () => {
  const ram = new Uint8Array(0x10000);
  // 60ca reads 0x5a first (cda2 lda), 0x99 thereafter -> cmp mismatch drives the unstable branch
  let readCount = 0;
  const mem = {
    read8: (a) => {
      if ((a & 0xffff) === 0x60ca) { readCount++; return readCount === 1 ? 0x5a : 0x99; }
      return ram[a & 0xffff];
    },
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  const m = makeMachine(mem);
  m.regs.s = 0xfd;
  m.push16(0x3000);
  ram[0x60da] = 0x3c;

  loc_cd95(m);

  assert.equal(ram[0x0720], 0x5a, "unstable -> cdb2 wrote A (0x5a) to 0x0720");
  assert.equal(ram[0x60cf], 0x07, "still reloads 60cf=7");
  assert.equal(m.regs.x, 0xff, "cdb5 ldx #0 then dex loop still ends at 0xff");
  assert.equal(m.pc, 0x3001, "rts");
});
