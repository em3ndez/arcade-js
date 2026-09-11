// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ddfb (ROM 0xddfb-0xde10) incl. the loc_ddff shared-tail entry. Author-derived
// 6502 harness with the page-1 stack seam (the tail uses pha/pla).
// Run: node --test games/tempest/translated/test/equivalence-ddfb.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ddfb, loc_ddff } from "../loc_ddfb.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_ddfb: A=$04,Y=$00 -> $01c6=0, $01c7|=4, $01c8|=4, rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1234); // rts -> 0x1235
  m.mem.write8(0x01c7, 0x10);
  m.mem.write8(0x01c8, 0x01);

  loc_ddfb(m);

  assert.equal(m.mem.read8(0x01c6), 0x00, "$01c6 = Y = 0");
  assert.equal(m.mem.read8(0x01c7), 0x14, "$01c7 = 0x10 | 0x04");
  assert.equal(m.mem.read8(0x01c8), 0x05, "$01c8 = 0x01 | 0x04");
  assert.equal(m.regs.a, 0x05, "A = pla(4) | $01c8(1) after final ora");
  assert.equal(m.pc, 0x1235, "rts -> pushed + 1");
  assert.equal(m.cycles, 37, "lda2+ldy2 + tail 33");
});

test("loc_ddff: shared tail with A/Y preset (A=$03,Y=$ff)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000); // rts -> 0x2001
  m.regs.a = 0x03; m.regs.y = 0xff;

  loc_ddff(m);

  assert.equal(m.mem.read8(0x01c6), 0xff, "$01c6 = Y = $ff");
  assert.equal(m.mem.read8(0x01c7), 0x03, "$01c7 = 0 | 0x03");
  assert.equal(m.mem.read8(0x01c8), 0x03, "$01c8 = 0 | 0x03");
  assert.equal(m.regs.a, 0x03, "A restored by pla");
  assert.equal(m.pc, 0x2001, "rts -> pushed + 1");
  assert.equal(m.cycles, 33, "sty4+pha3+ora4+sta4+pla4+ora4+sta4+rts6");
});
