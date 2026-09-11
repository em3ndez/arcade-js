// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ca48 (ROM 0xca48-0xca61). Minimal 6502 harness. The eor/and #$04/eor idiom folds
// bit 2 of A into $a1. Covers $0117==0 (clear bit2), $0117!=0 & $3d!=0 (set bit2), and $0117!=0 & $3d==0. Run:
//   node --test games/tempest/translated/test/equivalence-ca48.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ca48 } from "../loc_ca48.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_ca48: $0117==0 -> A=0/Y=0x10, clears bit2 of $a1; 29 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000); // rts -> 0x1001
  m.ram[0x0117] = 0x00; // beq at ca4d taken -> A=0, Y=0x10
  m.ram[0xa1] = 0xff;
  loc_ca48(m);
  assert.equal(m.ram[0xa1], 0xfb, "bit2 cleared (A bit2=0): 0xff -> 0xfb");
  assert.equal(m.ram[0xb4], 0x10, "$b4 = Y = 0x10");
  assert.equal(m.regs.y, 0x10, "Y = 0x10");
  assert.equal(m.regs.a, 0xfb, "A = folded result");
  assert.equal(m.pc, 0x1001, "rts");
  assert.equal(m.cycles, 29, "beq-taken T-state total");
});

test("loc_ca48: $0117!=0 & $3d!=0 -> A=0x04/Y=0x08, sets bit2 of $a1; 37 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.ram[0x0117] = 0x01; // beq not taken
  m.ram[0x3d] = 0x02;   // beq not taken -> A=0x04, Y=0x08
  m.ram[0xa1] = 0x00;
  loc_ca48(m);
  assert.equal(m.ram[0xa1], 0x04, "bit2 set (A bit2=1): 0x00 -> 0x04");
  assert.equal(m.ram[0xb4], 0x08, "$b4 = Y = 0x08");
  assert.equal(m.regs.y, 0x08, "Y = 0x08");
  assert.equal(m.regs.a, 0x04, "A = 0x04");
  assert.equal(m.pc, 0x2001, "rts");
  assert.equal(m.cycles, 37, "both-not-taken T-state total");
});

test("loc_ca48: $0117!=0 & $3d==0 -> A=0/Y=0x10 (second beq taken); 34 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000); // rts -> 0x3001
  m.ram[0x0117] = 0x01; // first beq not taken
  m.ram[0x3d] = 0x00;   // second beq taken -> A=0, Y=0x10
  m.ram[0xa1] = 0x06;
  loc_ca48(m);
  assert.equal(m.ram[0xa1], 0x02, "bit2 cleared: 0x06 -> 0x02");
  assert.equal(m.ram[0xb4], 0x10, "$b4 = Y = 0x10");
  assert.equal(m.regs.y, 0x10, "Y = 0x10");
  assert.equal(m.pc, 0x3001, "rts");
  assert.equal(m.cycles, 34, "second-beq-taken T-state total");
});
